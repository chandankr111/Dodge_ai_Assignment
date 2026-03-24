import { getDb } from '../db/connection.js';
export function buildGraph() {
    const db = getDb();
    const nodes = [];
    const edges = [];
    const addedNodes = new Set();
    function addNode(node) {
        if (!addedNodes.has(node.id)) {
            nodes.push(node);
            addedNodes.add(node.id);
        }
    }
    // ── 1. BUSINESS PARTNERS (Customers) ──────────────────────
    const partners = db.prepare(`
    SELECT bp.businessPartner, bp.businessPartnerName, 
           bp.businessPartnerFullName, bpa.cityName, bpa.country
    FROM business_partners bp
    LEFT JOIN business_partner_addresses bpa 
      ON bp.businessPartner = bpa.businessPartner
    LIMIT 100
  `).all();
    for (const bp of partners) {
        addNode({
            id: `bp-${bp.businessPartner}`,
            label: bp.businessPartnerName || bp.businessPartner,
            group: 'customer',
            data: bp
        });
    }
    // ── 2. SALES ORDER HEADERS ─────────────────────────────────
    const salesOrders = db.prepare(`
    SELECT salesOrder, soldToParty, totalNetAmount,
           transactionCurrency, overallDeliveryStatus,
           creationDate, customerPaymentTerms
    FROM sales_order_headers
    LIMIT 200
  `).all();
    for (const so of salesOrders) {
        addNode({
            id: `so-${so.salesOrder}`,
            label: `Order ${so.salesOrder}`,
            group: 'salesOrder',
            data: so
        });
        // Edge: Customer → Sales Order
        if (addedNodes.has(`bp-${so.soldToParty}`)) {
            edges.push({
                from: `bp-${so.soldToParty}`,
                to: `so-${so.salesOrder}`,
                label: 'placed'
            });
        }
    }
    // ── 3. DELIVERIES ──────────────────────────────────────────
    const deliveries = db.prepare(`
    SELECT DISTINCT 
      odh.deliveryDocument,
      odh.overallGoodsMovementStatus,
      odh.overallPickingStatus,
      odh.creationDate,
      odi.referenceSdDocument AS salesOrder
    FROM outbound_delivery_headers odh
    JOIN outbound_delivery_items odi 
      ON odh.deliveryDocument = odi.deliveryDocument
    LIMIT 200
  `).all();
    for (const del of deliveries) {
        addNode({
            id: `del-${del.deliveryDocument}`,
            label: `Delivery ${del.deliveryDocument}`,
            group: 'delivery',
            data: del
        });
        // Edge: Sales Order → Delivery
        if (addedNodes.has(`so-${del.salesOrder}`)) {
            edges.push({
                from: `so-${del.salesOrder}`,
                to: `del-${del.deliveryDocument}`,
                label: 'delivered via'
            });
        }
    }
    // ── 4. BILLING DOCUMENTS ───────────────────────────────────
    const billingDocs = db.prepare(`
    SELECT 
      bdh.billingDocument,
      bdh.soldToParty,
      bdh.totalNetAmount,
      bdh.transactionCurrency,
      bdh.billingDocumentDate,
      bdh.billingDocumentIsCancelled,
      bdh.accountingDocument,
      bdi.referenceSdDocument AS deliveryDocument
    FROM billing_document_headers bdh
    LEFT JOIN billing_document_items bdi 
      ON bdh.billingDocument = bdi.billingDocument
    LIMIT 200
  `).all();
    for (const bd of billingDocs) {
        addNode({
            id: `bd-${bd.billingDocument}`,
            label: `Invoice ${bd.billingDocument}`,
            group: 'billing',
            data: bd
        });
        // Edge: Delivery → Billing
        if (bd.deliveryDocument && addedNodes.has(`del-${bd.deliveryDocument}`)) {
            edges.push({
                from: `del-${bd.deliveryDocument}`,
                to: `bd-${bd.billingDocument}`,
                label: 'billed as'
            });
        }
    }
    // ── 5. PAYMENTS ────────────────────────────────────────────
    const payments = db.prepare(`
    SELECT 
      p.companyCode || '-' || p.fiscalYear || '-' || p.accountingDocument AS paymentId,
      p.customer,
      p.amountInTransactionCurrency,
      p.transactionCurrency,
      p.clearingDate,
      p.clearingAccountingDocument,
      bdh.billingDocument
    FROM payments_accounts_receivable p
    LEFT JOIN billing_document_headers bdh 
      ON p.clearingAccountingDocument = bdh.accountingDocument
    LIMIT 200
  `).all();
    for (const pay of payments) {
        addNode({
            id: `pay-${pay.paymentId}`,
            label: `Payment ${pay.amountInTransactionCurrency} ${pay.transactionCurrency}`,
            group: 'payment',
            data: pay
        });
        // Edge: Billing → Payment
        if (pay.billingDocument && addedNodes.has(`bd-${pay.billingDocument}`)) {
            edges.push({
                from: `bd-${pay.billingDocument}`,
                to: `pay-${pay.paymentId}`,
                label: 'paid by'
            });
        }
    }
    // ── 6. PRODUCTS (top 50 by usage) ─────────────────────────
    const products = db.prepare(`
    SELECT 
      p.product,
      pd.productDescription,
      p.productType,
      p.baseUnit,
      COUNT(soi.salesOrder) AS orderCount
    FROM products p
    LEFT JOIN product_descriptions pd 
      ON p.product = pd.product AND pd.language = 'EN'
    LEFT JOIN sales_order_items soi 
      ON p.product = soi.material
    GROUP BY p.product
    ORDER BY orderCount DESC
    LIMIT 50
  `).all();
    for (const prod of products) {
        addNode({
            id: `prod-${prod.product}`,
            label: prod.productDescription || prod.product,
            group: 'product',
            data: prod
        });
    }
    // Edge: Sales Order Item → Product
    const soItems = db.prepare(`
    SELECT DISTINCT salesOrder, material 
    FROM sales_order_items 
    LIMIT 300
  `).all();
    for (const item of soItems) {
        if (addedNodes.has(`so-${item.salesOrder}`) &&
            addedNodes.has(`prod-${item.material}`)) {
            edges.push({
                from: `so-${item.salesOrder}`,
                to: `prod-${item.material}`,
                label: 'includes'
            });
        }
    }
    return { nodes, edges };
}
//# sourceMappingURL=graphService.js.map