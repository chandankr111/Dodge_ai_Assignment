import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../db/connection.js';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// ── Database schema string sent to Gemini so it knows the tables ──
const DB_SCHEMA = `
You have access to a SQLite database with these tables:

1. sales_order_headers
   - salesOrder (PK), salesOrderType, salesOrganization, soldToParty,
     creationDate, totalNetAmount, overallDeliveryStatus,
     overallOrdReltdBillgStatus, transactionCurrency,
     requestedDeliveryDate, customerPaymentTerms

2. sales_order_items
   - salesOrder, salesOrderItem (PK), material, requestedQuantity,
     requestedQuantityUnit, netAmount, materialGroup,
     productionPlant, storageLocation

3. sales_order_schedule_lines
   - salesOrder, salesOrderItem, scheduleLine (PK),
     confirmedDeliveryDate, orderQuantityUnit,
     confdOrderQtyByMatlAvailCheck

4. outbound_delivery_headers
   - deliveryDocument (PK), actualGoodsMovementDate, creationDate,
     overallGoodsMovementStatus, overallPickingStatus, shippingPoint

5. outbound_delivery_items
   - deliveryDocument, deliveryDocumentItem (PK),
     actualDeliveryQuantity, deliveryQuantityUnit, plant,
     referenceSdDocument (= salesOrder), referenceSdDocumentItem,
     storageLocation

6. billing_document_headers
   - billingDocument (PK), billingDocumentType, billingDocumentDate,
     billingDocumentIsCancelled, totalNetAmount, transactionCurrency,
     companyCode, fiscalYear, accountingDocument, soldToParty

7. billing_document_items
   - billingDocument, billingDocumentItem (PK), material,
     billingQuantity, billingQuantityUnit, netAmount,
     referenceSdDocument (= deliveryDocument), referenceSdDocumentItem

8. billing_document_cancellations
   - billingDocument (PK), billingDocumentIsCancelled,
     cancelledBillingDocument, totalNetAmount, soldToParty,
     accountingDocument

9. payments_accounts_receivable
   - companyCode, fiscalYear, accountingDocument,
     accountingDocumentItem (PK), clearingDate,
     clearingAccountingDocument, amountInTransactionCurrency,
     transactionCurrency, customer, postingDate

10. journal_entry_items_ar
    - companyCode, fiscalYear, accountingDocument,
      accountingDocumentItem (PK), glAccount, referenceDocument,
      amountInTransactionCurrency, transactionCurrency,
      customer, postingDate, clearingDate, clearingAccountingDocument

11. business_partners
    - businessPartner (PK), customer, businessPartnerName,
      businessPartnerFullName, businessPartnerCategory,
      businessPartnerIsBlocked, creationDate

12. business_partner_addresses
    - businessPartner, addressId (PK), cityName, country,
      postalCode, region, streetName

13. customer_company_assignments
    - customer, companyCode (PK), paymentTerms,
      reconciliationAccount, customerAccountGroup

14. customer_sales_area_assignments
    - customer, salesOrganization, distributionChannel,
      division (PK), customerPaymentTerms, incotermsClassification,
      currency, shippingCondition

15. products
    - product (PK), productType, productGroup, baseUnit,
      grossWeight, weightUnit, netWeight, division,
      isMarkedForDeletion, creationDate

16. product_descriptions
    - product, language (PK), productDescription

17. product_plants
    - product, plant (PK), availabilityCheckType,
      profitCenter, mrpType

18. product_storage_locations
    - product, plant, storageLocation (PK),
      physicalInventoryBlockInd

19. plants
    - plant (PK), plantName, companyCode, salesOrganization,
      distributionChannel, division, factoryCalendar

KEY RELATIONSHIPS:
- sales_order_headers.soldToParty = business_partners.businessPartner
- sales_order_items.salesOrder = sales_order_headers.salesOrder
- outbound_delivery_items.referenceSdDocument = sales_order_headers.salesOrder
- billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument
- billing_document_headers.accountingDocument = journal_entry_items_ar.referenceDocument
- billing_document_headers.accountingDocument = payments_accounts_receivable.clearingAccountingDocument
- sales_order_items.material = products.product
`;
// ── Guardrail: check if question is dataset-related ──────────
async function isDatasetRelated(question) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
You are a classifier. Determine if the following question is related to 
SAP business data including: sales orders, deliveries, billing documents, 
invoices, payments, customers, products, journal entries, or business partners.

Answer with ONLY "YES" or "NO". Nothing else.

Question: "${question}"
`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toUpperCase();
        return text.startsWith('YES');
    }
    catch {
        return false;
    }
}
// ── Step 1: Convert question to SQL ──────────────────────────
async function generateSQL(question) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
You are an expert SQLite query generator for a SAP Order-to-Cash database.

${DB_SCHEMA}

RULES:
- Return ONLY the SQL query, nothing else
- No markdown, no backticks, no explanation
- Use proper SQLite syntax
- Always use LIMIT (max 100 rows) unless counting
- Use LEFT JOIN when data might be missing
- For "trace full flow" queries, join across all tables
- For "broken flow" queries, use NOT EXISTS or LEFT JOIN ... WHERE IS NULL

Question: "${question}"

SQL:
`;
    const result = await model.generateContent(prompt);
    let sql = result.response.text().trim();
    // Clean up any accidental markdown
    sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
    return sql;
}
// ── Step 2: Execute SQL safely ────────────────────────────────
function executeSQL(sql) {
    const db = getDb();
    // Block any destructive operations
    const forbidden = /^\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i;
    if (forbidden.test(sql)) {
        return { data: [], error: 'Only SELECT queries are allowed.' };
    }
    try {
        const data = db.prepare(sql).all();
        return { data };
    }
    catch (err) {
        return { data: [], error: err.message };
    }
}
// ── Step 3: Summarize results in plain English ────────────────
async function summarizeResults(question, sql, data) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const dataPreview = data.slice(0, 20); // send max 20 rows to Gemini
    const prompt = `
You are a helpful business analyst assistant for a SAP Order-to-Cash system.

The user asked: "${question}"

The SQL query used was:
${sql}

The query returned ${data.length} rows. Here is a preview:
${JSON.stringify(dataPreview, null, 2)}

Write a clear, concise answer in plain English. 
- Highlight key numbers and insights
- If there are many rows, summarize patterns
- Keep it under 150 words
- Do not mention SQL or technical details
- Sound like a business analyst reporting findings
`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}
export async function handleChatQuery(question) {
    // Step 1: Guardrail check
    const relevant = await isDatasetRelated(question);
    if (!relevant) {
        return {
            answer: 'This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask about sales orders, deliveries, invoices, payments, customers, or products.',
            isRelevant: false
        };
    }
    // Step 2: Generate SQL
    const sql = await generateSQL(question);
    // Step 3: Execute SQL
    const { data, error } = executeSQL(sql);
    if (error) {
        // If SQL failed, try once more with error context
        const fixedSql = await generateSQL(`${question}\n\nNote: Previous attempt failed with error: ${error}. Fix the SQL.`);
        const retry = executeSQL(fixedSql);
        if (retry.error) {
            return {
                answer: `I couldn't retrieve that data. Please try rephrasing your question.`,
                sql: fixedSql,
                data: [],
                isRelevant: true
            };
        }
        const answer = await summarizeResults(question, fixedSql, retry.data);
        return { answer, sql: fixedSql, data: retry.data, isRelevant: true };
    }
    // Step 4: Summarize
    const answer = await summarizeResults(question, sql, data);
    return { answer, sql, data, isRelevant: true };
}
//# sourceMappingURL=llmService.js.map