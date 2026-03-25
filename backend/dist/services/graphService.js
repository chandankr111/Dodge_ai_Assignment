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
    // 1) Customers
    const customers = db.prepare(`
    SELECT
      bp.businessPartner,
      bp.businessPartnerName,
      bp.businessPartnerFullName,
      bp.businessPartnerCategory,
      bp.businessPartnerIsBlocked,
      bp.creationDate,
      bpa.cityName,
      bpa.country,
      bpa.streetName,
      bpa.postalCode
    FROM business_partners bp
    LEFT JOIN business_partner_addresses bpa
      ON bp.businessPartner = bpa.businessPartner
    LIMIT 50
  `).all();
    for (const c of customers) {
        addNode({
            id: `bp-${c.businessPartner}`,
            label: c.businessPartnerName || c.businessPartner,
            group: 'customer',
            data: { ...c, nodeType: 'Customer' }
        });
    }
    // 2) Sales Orders
    const salesOrders = db.prepare(`
    SELECT
      soh.salesOrder,
      soh.salesOrderType,
      soh.soldToParty,
      soh.totalNetAmount,
      soh.transactionCurrency,
      soh.overallDeliveryStatus,
      soh.creationDate,
      soh.requestedDeliveryDate,
      soh.customerPaymentTerms,
      soh.incotermsClassification,
      COUNT(soi.salesOrderItem) AS itemCount
    FROM sales_order_headers soh
    LEFT JOIN sales_order_items soi
      ON soh.salesOrder = soi.salesOrder
    GROUP BY soh.salesOrder
    LIMIT 100
  `).all();
    for (const so of salesOrders) {
        addNode({
            id: `so-${so.salesOrder}`,
            label: `Order ${so.salesOrder}`,
            group: 'salesOrder',
            data: {
                ...so,
                nodeType: 'Sales Order',
                status: so.overallDeliveryStatus === 'C'
                    ? 'Completed'
                    : so.overallDeliveryStatus === 'A'
                        ? 'In Progress'
                        : 'Unknown'
            }
        });
        if (addedNodes.has(`bp-${so.soldToParty}`)) {
            edges.push({ from: `bp-${so.soldToParty}`, to: `so-${so.salesOrder}`, label: 'placed' });
        }
    }
    // 3) Deliveries
    const deliveries = db.prepare(`
    SELECT
      odh.deliveryDocument,
      odh.creationDate,
      odh.actualGoodsMovementDate,
      odh.overallGoodsMovementStatus,
      odh.overallPickingStatus,
      odh.shippingPoint,
      odi.referenceSdDocument AS salesOrder,
      COUNT(odi.deliveryDocumentItem) AS itemCount
    FROM outbound_delivery_headers odh
    LEFT JOIN outbound_delivery_items odi
      ON odh.deliveryDocument = odi.deliveryDocument
    GROUP BY odh.deliveryDocument
    LIMIT 100
  `).all();
    for (const del of deliveries) {
        addNode({
            id: `del-${del.deliveryDocument}`,
            label: `Delivery ${del.deliveryDocument}`,
            group: 'delivery',
            data: {
                ...del,
                nodeType: 'Outbound Delivery',
                status: del.overallGoodsMovementStatus === 'C'
                    ? 'Goods Moved'
                    : del.overallGoodsMovementStatus === 'A'
                        ? 'In Progress'
                        : 'Pending'
            }
        });
        if (del.salesOrder && addedNodes.has(`so-${del.salesOrder}`)) {
            edges.push({ from: `so-${del.salesOrder}`, to: `del-${del.deliveryDocument}`, label: 'delivered via' });
        }
    }
    // 4) Billing
    const billingDocs = db.prepare(`
    SELECT
      bdh.billingDocument,
      bdh.billingDocumentType,
      bdh.billingDocumentDate,
      bdh.billingDocumentIsCancelled,
      bdh.totalNetAmount,
      bdh.transactionCurrency,
      bdh.soldToParty,
      bdh.accountingDocument,
      bdh.companyCode,
      bdh.fiscalYear,
      bdi.referenceSdDocument AS deliveryDocument
    FROM billing_document_headers bdh
    LEFT JOIN billing_document_items bdi
      ON bdh.billingDocument = bdi.billingDocument
    GROUP BY bdh.billingDocument
    LIMIT 100
  `).all();
    for (const bd of billingDocs) {
        addNode({
            id: `bd-${bd.billingDocument}`,
            label: `Invoice ${bd.billingDocument}`,
            group: 'billing',
            data: {
                ...bd,
                nodeType: 'Billing Document',
                status: bd.billingDocumentIsCancelled ? 'Cancelled' : 'Active'
            }
        });
        if (bd.deliveryDocument && addedNodes.has(`del-${bd.deliveryDocument}`)) {
            edges.push({ from: `del-${bd.deliveryDocument}`, to: `bd-${bd.billingDocument}`, label: 'billed as' });
        }
    }
    // 5) Payments
    const payments = db.prepare(`
    SELECT
      p.companyCode,
      p.fiscalYear,
      p.accountingDocument,
      p.accountingDocumentItem,
      p.customer,
      p.amountInTransactionCurrency,
      p.transactionCurrency,
      p.clearingDate,
      p.clearingAccountingDocument,
      p.postingDate,
      bdh.billingDocument
    FROM payments_accounts_receivable p
    LEFT JOIN billing_document_headers bdh
      ON p.clearingAccountingDocument = bdh.accountingDocument
    LIMIT 100
  `).all();
    for (const pay of payments) {
        const payId = `${pay.companyCode}-${pay.fiscalYear}-${pay.accountingDocument}-${pay.accountingDocumentItem}`;
        addNode({
            id: `pay-${payId}`,
            label: `Payment ${pay.amountInTransactionCurrency} ${pay.transactionCurrency}`,
            group: 'payment',
            data: { ...pay, nodeType: 'Payment', status: pay.clearingDate ? 'Cleared' : 'Open' }
        });
        if (pay.billingDocument && addedNodes.has(`bd-${pay.billingDocument}`)) {
            edges.push({ from: `bd-${pay.billingDocument}`, to: `pay-${payId}`, label: 'paid by' });
        }
    }
    // 6) Products
    const products = db.prepare(`
    SELECT
      p.product,
      p.productType,
      p.baseUnit,
      p.productGroup,
      p.grossWeight,
      p.weightUnit,
      pd.productDescription,
      COUNT(DISTINCT soi.salesOrder) AS orderCount
    FROM products p
    LEFT JOIN product_descriptions pd
      ON p.product = pd.product
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
            data: { ...prod, nodeType: 'Product' }
        });
    }
    // 7) SO -> Product edges
    const soProductLinks = db.prepare(`
    SELECT DISTINCT
      soi.salesOrder,
      soi.material,
      soi.requestedQuantity
    FROM sales_order_items soi
    WHERE soi.salesOrder IN (SELECT salesOrder FROM sales_order_headers LIMIT 100)
    LIMIT 200
  `).all();
    for (const link of soProductLinks) {
        if (addedNodes.has(`so-${link.salesOrder}`) && addedNodes.has(`prod-${link.material}`)) {
            edges.push({ from: `so-${link.salesOrder}`, to: `prod-${link.material}`, label: `qty: ${link.requestedQuantity}` });
        }
    }
    // 8) Journals
    const journals = db.prepare(`
    SELECT
      j.companyCode,
      j.fiscalYear,
      j.accountingDocument,
      j.accountingDocumentItem,
      j.glAccount,
      j.referenceDocument,
      j.amountInTransactionCurrency,
      j.transactionCurrency,
      j.customer,
      j.postingDate,
      bdh.billingDocument
    FROM journal_entry_items_ar j
    LEFT JOIN billing_document_headers bdh
      ON j.referenceDocument = bdh.accountingDocument
    LIMIT 80
  `).all();
    for (const j of journals) {
        const jId = `${j.companyCode}-${j.fiscalYear}-${j.accountingDocument}-${j.accountingDocumentItem}`;
        addNode({
            id: `jnl-${jId}`,
            label: `Journal ${j.accountingDocument}`,
            group: 'journal',
            data: { ...j, nodeType: 'Journal Entry' }
        });
        if (j.billingDocument && addedNodes.has(`bd-${j.billingDocument}`)) {
            edges.push({ from: `bd-${j.billingDocument}`, to: `jnl-${jId}`, label: 'posted to' });
        }
    }
    return { nodes, edges };
}
//# sourceMappingURL=graphService.js.map