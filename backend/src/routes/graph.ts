import { Router } from 'express';
import type { Request, Response } from 'express';
import { buildGraph } from '../services/graphService.js';
import { getDb } from '../db/connection.js';

const router = Router();

// GET /api/graph  — full graph
router.get('/', (req: Request, res: Response) => {
  try {
    const graph = buildGraph();
    res.json(graph);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build graph' });
  }
});

// GET /api/graph/node/:id  — metadata for a single node
router.get('/node/:type/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { type, id } = req.params;

  try {
    let data: any = null;

    if (type === 'so') {
      data = {
        header: db.prepare(
          `SELECT * FROM sales_order_headers WHERE salesOrder = ?`
        ).get(id),
        items: db.prepare(
          `SELECT * FROM sales_order_items WHERE salesOrder = ?`
        ).all(id)
      };
    } else if (type === 'del') {
      data = {
        header: db.prepare(
          `SELECT * FROM outbound_delivery_headers WHERE deliveryDocument = ?`
        ).get(id),
        items: db.prepare(
          `SELECT * FROM outbound_delivery_items WHERE deliveryDocument = ?`
        ).all(id)
      };
    } else if (type === 'bd') {
      data = {
        header: db.prepare(
          `SELECT * FROM billing_document_headers WHERE billingDocument = ?`
        ).get(id),
        items: db.prepare(
          `SELECT * FROM billing_document_items WHERE billingDocument = ?`
        ).all(id)
      };
    } else if (type === 'bp') {
      data = {
        partner: db.prepare(
          `SELECT * FROM business_partners WHERE businessPartner = ?`
        ).get(id),
        address: db.prepare(
          `SELECT * FROM business_partner_addresses WHERE businessPartner = ?`
        ).get(id)
      };
    } else if (type === 'pay') {
      data = db.prepare(
        `SELECT * FROM payments_accounts_receivable
         WHERE companyCode || '-' || fiscalYear || '-' || accountingDocument || '-' || accountingDocumentItem = ?`
      ).get(id);
    } else if (type === 'prod') {
      data = {
        product: db.prepare(
          `SELECT * FROM products WHERE product = ?`
        ).get(id),
        descriptions: db.prepare(
          `SELECT * FROM product_descriptions WHERE product = ?`
        ).all(id)
      };
    } else if (type === 'jnl') {
      data = db.prepare(
        `SELECT * FROM journal_entry_items_ar
         WHERE companyCode || '-' || fiscalYear || '-' || accountingDocument || '-' || accountingDocumentItem = ?`
      ).get(id);
    }

    if (!data) return res.status(404).json({ error: 'Node not found' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch node data' });
  }
});

export default router;