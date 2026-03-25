# Graph-Based Order-to-Cash (O2C) Query System

This project turns an SAP-style **Order-to-Cash (O2C)** dataset into a **context graph** (nodes + edges) and adds a **natural language chat** interface powered by an LLM. Users can:

- Explore the O2C process visually (Customer → Sales Order → Delivery → Billing → Journal → Payment).
- Ask questions like “trace the full flow of billing document X” or “show invoices not yet paid”.

The implementation is intentionally **simple, portable, and demo-friendly**: relational data in SQLite + graph projection in the API + a lightweight Vite/React UI.

---

## Live links (deployment)

- **Frontend (Vercel)**: `https://dodge-ai-assignment-pi.vercel.app`
- **Backend (Railway API)**: `https://dodgeaibackend-production.up.railway.app`
  - Health: `https://dodgeaibackend-production.up.railway.app/health`

---

## Working directories (monorepo)

- **Backend**: `backend/`
- **Frontend**: `frontend/`

When deploying:

- **Vercel**: set **Root Directory** to `frontend`
- **Railway**: deploy the backend from `backend` (Dockerfile or Node build), and ensure the service is exposed on the same port the app listens on (default `8000`).

---

## Architecture decisions (high level)

### Components

- **Database (SQLite)**: stores normalized tables from JSONL inputs.
- **Backend (Node.js + Express + TypeScript)**:
  - **`GET /api/graph`** returns graph nodes/edges for visualization.
  - **`POST /api/chat`** answers natural-language queries using a mix of:
    - deterministic “trace flow” logic (no hallucination),
    - prebuilt SQL templates for common “broken flow” questions,
    - LLM-assisted SQL generation for open-ended analytics questions.
- **Frontend (Vite + React + TypeScript)**:
  - Graph view (vis-network)
  - Chat panel
  - Node inspector

### Why “graph projection” (nodes/edges) instead of a graph database?

The dataset is naturally **relational**, and the O2C flow is represented by stable keys (Sales Order, Delivery, Billing, Accounting Document, etc.). For this data size and use case:

- **SQLite JOINs are sufficient** to compute relationships.
- We can project the graph in the backend into `{ nodes, edges }` for the UI.
- This avoids running a separate graph database (Neo4j), keeping deployment and local setup simple.

---

## Database

### Choice: SQLite (via `better-sqlite3`)

**Why SQLite?**

- **Zero infrastructure**: one file (`database.sqlite`) instead of a DB server.
- **Fast local reads**: in-process DB access (no network hop).
- **Portability**: easy to ship as part of a demo or container image.
- **SQL power**: multi-table JOINs map naturally to O2C relationships.

**Trade-off**: SQLite is not ideal for multi-instance writes or large-scale production. For this assignment/demo, the simplicity and portability are the priority.

### Data model

The database contains tables that represent O2C documents and master data. The backend primarily relies on these relationships:

- **Customer → Sales Order**
  - `business_partners.businessPartner = sales_order_headers.soldToParty`
- **Sales Order → Delivery**
  - `outbound_delivery_items.referenceSdDocument = sales_order_headers.salesOrder`
- **Delivery → Billing**
  - `billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument`
- **Billing → Journal / Payment**
  - accounting doc joins (AR journal items and clearing documents)

This chain enables the end-to-end trace:

Customer → Sales Order → Delivery → Billing → Journal → Payment

### DB path + runtime behavior

- **Default DB path**: `backend/database.sqlite` (resolved in code relative to `backend/src/db`).
- **Override**: set `DATABASE_PATH` (absolute path or relative to the process working directory).
- On first access, the backend:
  - opens SQLite via `better-sqlite3`
  - enables WAL (`PRAGMA journal_mode=WAL`)
  - ensures tables exist (runs schema creation)

### Seeding strategy (JSONL → SQLite)

The repository includes a seeder that loads JSONL files into SQLite in **batch transactions**.

Implementation details (from the code):

- **Booleans are normalized to 0/1** before inserts (SQLite INTEGER columns + better-sqlite3 binding).
- Product descriptions are seeded (used for user-friendly product labels/descriptions).
- Inserts use `INSERT OR REPLACE` to keep the seed idempotent.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                            │
│                                                                   │
│  ┌─────────────────────────────┐   ┌───────────────────────────┐  │
│  │  Graph View (vis-network)   │   │  Chat Panel (React UI)     │  │
│  │  - nodes/edges              │   │  - NL questions            │  │
│  │  - node inspector           │   │  - flow step rendering     │  │
│  └───────────────┬─────────────┘   └──────────────┬────────────┘  │
│                  │                                 │               │
│                  └───────────────┬─────────────────┘               │
│                                  │                                 │
│                        React + TypeScript (Vite)                    │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ HTTPS (REST)
                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js / Express)                   │
│                                                                   │
│  Routes                                                           │
│  - GET  /health                                                   │
│  - GET  /api/graph            -> builds graph nodes/edges          │
│  - GET  /api/graph/node/:t/:i -> fetch node metadata              │
│  - POST /api/chat             -> NL → (trace / sql) → answer       │
│                                                                   │
│  ┌───────────────────────────┐   ┌─────────────────────────────┐  │
│  │  Graph Service            │   │  LLM Service                 │  │
│  │  - SQL selects + edges    │   │  - query type detection      │  │
│  │  - node projection        │   │  - (optional) SQL generation │  │
│  └──────────────┬────────────┘   │  - summarization             │  │
│                 │                │  - guardrails + fallback      │  │
│                 │                └──────────────┬────────────────┘  │
│                 │                               │                   │
│                 ▼                               ▼                   │
│         SQLite (better-sqlite3)           LLM Provider              │
│         - database.sqlite                - Groq (preferred)         │
│         - relational O2C tables          - Gemini (optional)        │
└───────────────────────────────────────────────────────────────────┘
```

---

## Backend

### Tech stack

- Node.js, Express, TypeScript
- SQLite via `better-sqlite3`
- LLM provider support:
  - **Groq** (preferred when `GROQ_API_KEY` is set)
  - **Gemini** (fallback / optional)

### Key endpoints

- **`GET /health`**: service health check
- **`GET /api/graph`**: full graph (nodes + edges)
- **`GET /api/graph/node/:type/:id`**: node detail for inspector panel
- **`POST /api/chat`**: natural language Q&A

### Graph building approach (projection)

The graph returned by `GET /api/graph` is **computed on demand** from relational tables and projected into:

- `nodes[]`: `{ id, label, group, data }`
- `edges[]`: `{ from, to, label }`

The backend adds nodes by “entity type” and creates edges when a relationship exists. For example:

- `customer (bp-*)` → `salesOrder (so-*)` edge label: `placed`
- `salesOrder (so-*)` → `delivery (del-*)` edge label: `delivered via`
- `delivery (del-*)` → `billing (bd-*)` edge label: `billed as`
- `billing (bd-*)` → `payment (pay-*)` edge label: `paid by`

This makes the UI fast and keeps the database design purely relational.

### LLM prompting strategy

The backend uses the LLM in *two* places, and avoids the LLM entirely where determinism matters.

#### 1) SQL generation (LLM-assisted)

For general analytical questions (“top customers by revenue”, “total unpaid amount”), the service prompts the LLM to output **raw SQLite SELECT** only.

Prompt constraints (strategy):

- Provide the **schema** and key relationships.
- Enforce **output format**: “Return ONLY raw SQL”.
- Enforce **safety**: “SELECT only”.
- Encourage **LEFT JOIN** to tolerate missing relationships.
- Require **LIMIT** for non-aggregation queries.

If LLM generation fails, the backend falls back to a small set of heuristic SQL templates.

#### 2) Result summarization (LLM-assisted)

After executing SQL, the backend asks the LLM to summarize results like a business analyst:

- highlight key numbers,
- describe flow steps when tracing,
- avoid mentioning tables/SQL,
- keep responses short and readable.

If summarization fails, the backend returns a simple deterministic summary (row count + a small preview).

#### 3) Trace flow (no LLM)

For “trace the full flow of document X”, the backend uses deterministic logic + SQL lookups (no LLM). This avoids hallucinations in the most “business-critical” feature.

### Provider choice (Groq vs Gemini)

The backend supports two providers:

- **Groq**: OpenAI-style chat completions at `https://api.groq.com/openai/v1/chat/completions`
- **Gemini**: `@google/generative-ai` SDK (optional)

Provider selection is automatic:

- if `GROQ_API_KEY` is present → Groq is selected
- else → Gemini is used (if configured)

Recommended Groq model (current default in code): `llama-3.3-70b-versatile`.

### Guardrails

Guardrails are implemented in layers to keep the system safe and predictable:

1. **Relevance filter (dataset guardrail)**  
   Blocks clearly off-topic questions (general knowledge, poems, coding help). Only O2C-related queries are processed.

2. **SQL safety filter**  
   Even if the LLM outputs something unsafe, execution rejects non-SELECT statements:

   - DROP / DELETE / UPDATE / INSERT / ALTER / CREATE / TRUNCATE are blocked.

3. **Failure fallback**  
   If the LLM is unavailable, misconfigured, rate-limited, or errors:
   - SQL generation falls back to prebuilt templates.
   - Summarization falls back to deterministic summaries.

### LLM provider configuration

The backend auto-selects the provider:

- If `GROQ_API_KEY` is set → **Groq** is used by default.
- Otherwise → **Gemini** is used (if configured).

Common env vars (set in Railway for production):

- `PORT` (Railway will route traffic to this)
- `DATABASE_PATH` (optional)
- `CORS_ORIGIN` (comma-separated allowed origins; leave empty to allow all)
- `GROQ_API_KEY`
- `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)
- `LLM_PROVIDER` (optional: `groq` or `gemini`)
- `GEMINI_API_KEY` (optional if you only use Groq)
- `GEMINI_MODEL` (optional)

---

## Frontend

### Tech stack

- Vite + React + TypeScript
- `vis-network` for graph visualization
- `axios` for API calls

### Runtime API configuration

The frontend reads the backend URL from:

- `VITE_API_BASE_URL`

Example:

- Local: `http://localhost:8000`
- Prod: `https://<your-railway-backend>.up.railway.app`

The API base URL is normalized to avoid double slashes.

### UI behavior

- **Graph view**:
  - loads nodes/edges from `GET /api/graph`
  - stabilizes a physics layout then disables physics for smooth interaction
  - clicking a node opens the inspector panel with node metadata
- **Chat panel**:
  - sends `POST /api/chat`
  - renders:
    - `data.flow[]` as expandable “Document Flow” steps, or
    - array results as a small table preview

---

## Deployment notes (Vercel + Railway)

### Backend on Railway

- Deploy the backend service (Docker or Node build).
- Ensure **service port** matches your app port (commonly `8000` here).
- Set Railway environment variables:
  - `GROQ_API_KEY`
  - `GROQ_MODEL=llama-3.3-70b-versatile`
  - `CORS_ORIGIN=https://<your-vercel-frontend>.vercel.app`

### Frontend on Vercel

- Root directory: `frontend`
- Set env var:
  - `VITE_API_BASE_URL=https://<your-railway-backend>.up.railway.app`
- Redeploy after setting env vars (Vite reads them at build time).

---

## Local development (quick)

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

