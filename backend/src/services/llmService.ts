import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../db/connection.js';

type LLMProvider = 'groq' | 'gemini';

function getLLMConfig(): {
  provider: LLMProvider;
  geminiApiKey?: string;
  geminiModel: string;
  groqApiKey?: string;
  groqModel: string;
} {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const groqApiKey = process.env.GROQ_API_KEY?.trim();

  const providerFromEnv = process.env.LLM_PROVIDER?.trim().toLowerCase();
  const provider: LLMProvider =
    providerFromEnv === 'groq' || providerFromEnv === 'gemini'
      ? (providerFromEnv as LLMProvider)
      : groqApiKey
        ? 'groq'
        : 'gemini';

  const config: {
    provider: LLMProvider;
    geminiApiKey?: string;
    geminiModel: string;
    groqApiKey?: string;
    groqModel: string;
  } = {
    provider,
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest',
    groqModel: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
  };

  if (geminiApiKey) config.geminiApiKey = geminiApiKey;
  if (groqApiKey) config.groqApiKey = groqApiKey;
  return config;
}
let llmDisabledForProcess = false;
let llmDisableReasonLogged = false;

function isInvalidApiKeyError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object' && err !== null) {
    const maybeError = err as { message?: unknown };
    if (typeof maybeError.message === 'string') {
      const msg = maybeError.message.toLowerCase();
      return (
        msg.includes('api key not valid') ||
        msg.includes('invalid api key') ||
        msg.includes('api_key_invalid') ||
        msg.includes('authentication') ||
        msg.includes('not authorized') ||
        msg.includes('permission denied') ||
        msg.includes('401')
      );
    }
  }
  return false;
}

function disableLLMWithWarning(reason?: unknown): void {
  llmDisabledForProcess = true;
  if (!llmDisableReasonLogged) {
    // Avoid logging secrets; only log a trimmed error message.
    const maybeMsg = (() => {
      if (typeof reason === 'object' && reason !== null) {
        const r = reason as { message?: unknown };
        return typeof r.message === 'string' ? r.message.slice(0, 400) : undefined;
      }
      return undefined;
    })();

    console.warn(
      maybeMsg
        ? `LLM API key is invalid/unauthorized (${maybeMsg}). LLM features disabled for this process; using fallback summaries.`
        : 'LLM API key is invalid/unauthorized. LLM features disabled for this process; using fallback summaries.'
    );
    llmDisableReasonLogged = true;
  }
}

async function generateWithGroq(
  userPrompt: string,
  opts: { maxTokens: number; temperature: number }
): Promise<string> {
  const { groqApiKey, groqModel } = getLLMConfig();
  if (!groqApiKey) throw new Error('GROQ_API_KEY is missing');

  const body = {
    model: groqModel,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep json as null; we'll use raw text for error message
  }

  if (!res.ok) {
    const apiMessage =
      json?.error?.message ||
      json?.message ||
      text ||
      `Groq API error (status ${res.status})`;
    throw new Error(apiMessage);
  }

  return (json?.choices?.[0]?.message?.content || '').toString().trim();
}

// ================================================================
// DATABASE SCHEMA
// ================================================================
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

// ================================================================
// INTERFACES
// ================================================================
export interface ChatResponse {
  answer: string;
  sql?: string;
  data?: any;
  isRelevant: boolean;
  queryType?: string;
}

// ================================================================
// GUARDRAIL
// ================================================================
function isDatasetRelated(question: string): boolean {
  const q = question.toLowerCase();
  const blockedPatterns = [
    'capital of',
    'history of',
    'write me a poem',
    'poem about',
    'reverse a string',
    'in python',
    'in javascript',
    'in java',
    'what is 2 + 2'
  ];

  if (blockedPatterns.some((p) => q.includes(p))) {
    return false;
  }
  
  // Keywords that indicate dataset-related questions
  const relevantkeywords = [
    'sales order',
    'delivery',
    'billing',
    'invoice',
    'payment',
    'customer',
    'partner',
    'product',
    'material',
    'journal',
    'accounting',
    'plant',
    'storage',
    'trace',
    'flow',
    'broken',
    'incomplete',
    'billed',
    'paid',
    'cancelled',
    'status',
    'order',
    'shipment',
    'shipped',
    'delivered',
    'goods',
    'quantity',
    'amount',
    'number',
    'document',
    'dispatch',
    'receipt',
    'cash flow',
    'reconcil',
    'clearing',
    'accounts receivable'
  ];

  // Check if question contains with any relevant keyword
  if (relevantkeywords.some(keyword => q.includes(keyword))) {
    return true;
  }

  // Check for numeric document IDs (6-12 digit numbers)
  if (/\b\d{6,12}\b/.test(q)) {
    return true;
  }

  // Default to false for completely unrelated topics
  return false;
}

// ================================================================
// QUERY TYPE DETECTOR
// ================================================================
function detectQueryType(question: string): string {
  const q = question.toLowerCase();

  if (
    q.includes('trace') ||
    q.includes('full flow') ||
    q.includes('flow of') ||
    q.includes('end to end') ||
    q.includes('end-to-end') ||
    q.includes('complete journey')
  ) {
    return 'TRACE_FLOW';
  }

  if (
    q.includes('broken') ||
    q.includes('incomplete') ||
    q.includes('not billed') ||
    q.includes('not paid') ||
    q.includes('without billing') ||
    q.includes('without payment') ||
    q.includes('missing') ||
    q.includes('no invoice') ||
    q.includes('no delivery') ||
    q.includes('no payment')
  ) {
    return 'BROKEN_FLOW';
  }

  return 'GENERAL';
}

// ================================================================
// TRACE FLOW — full document chain
// ================================================================
function traceDocumentFlow(docNumber: string): any {
  const db = getDb();

  const result: any = {
    documentNumber: docNumber,
    documentType: null,
    flow: []
  };

  // ── Try Billing Document first ──────────────────────────────
  const billingDoc = db.prepare(`
    SELECT * FROM billing_document_headers
    WHERE billingDocument = ?
  `).get(docNumber) as any;

  const billingItems = db.prepare(`
    SELECT bdi.*,
           COALESCE(
             (
               SELECT productDescription
               FROM product_descriptions
               WHERE product = bdi.material AND language = 'EN'
               LIMIT 1
             ),
             (
               SELECT productDescription
               FROM product_descriptions
               WHERE product = bdi.material
               LIMIT 1
             )
             ,
             'Not available'
           ) AS productDescription
    FROM billing_document_items bdi
    WHERE bdi.billingDocument = ?
  `).all(docNumber) as any[];

  // Important: some datasets may contain billing items but no billing header row.
  // In that case we can still trace the chain (Delivery -> Sales Order -> Customer),
  // but journal/payment details are not available because billing_header.accountingDocument is missing.
  if (billingDoc || billingItems.length > 0) {
    result.documentType = 'Billing Document';

    // Step 1: Billing Document Header (optional)
    if (billingDoc) {
      result.flow.push({
        step: 1,
        entity: 'Billing Document',
        status: billingDoc.billingDocumentIsCancelled ? 'Cancelled' : 'Active',
        data: billingDoc
      });
    } else {
      result.flow.push({
        step: 1,
        entity: 'Billing Document',
        status: 'Header not found (partial billing data)',
        data: {}
      });
    }

    // Step 2: Billing Items
    result.flow.push({
      step: 2,
      entity: 'Billing Items',
      count: billingItems.length,
      data: billingItems
    });

    // Step 3: Outbound Delivery (via the first delivery reference)
    if (billingItems.length > 0 && billingItems[0].referenceSdDocument) {
      const deliveryDoc = db.prepare(`
        SELECT * FROM outbound_delivery_headers
        WHERE deliveryDocument = ?
      `).get(billingItems[0].referenceSdDocument) as any;

      if (deliveryDoc) {
        result.flow.push({
          step: 3,
          entity: 'Outbound Delivery',
          status: deliveryDoc.overallGoodsMovementStatus,
          data: deliveryDoc
        });

        // Step 4: Sales Order via delivery items
        const deliveryItems = db.prepare(`
          SELECT * FROM outbound_delivery_items
          WHERE deliveryDocument = ?
        `).all(deliveryDoc.deliveryDocument) as any[];

        if (deliveryItems.length > 0 && deliveryItems[0].referenceSdDocument) {
          const salesOrder = db.prepare(`
            SELECT soh.*,
                   COALESCE(bp.businessPartnerName, '') AS customerName
            FROM sales_order_headers soh
            LEFT JOIN business_partners bp
              ON soh.soldToParty = bp.businessPartner
            WHERE soh.salesOrder = ?
          `).get(deliveryItems[0].referenceSdDocument) as any;

          if (salesOrder) {
            result.flow.push({
              step: 4,
              entity: 'Sales Order',
              status: salesOrder.overallDeliveryStatus,
              data: salesOrder
            });

            // Step 5: Sales Order Items
            const soItems = db.prepare(`
              SELECT soi.*,
                     COALESCE(
                       (
                         SELECT productDescription
                         FROM product_descriptions
                         WHERE product = soi.material AND language = 'EN'
                         LIMIT 1
                       ),
                       (
                         SELECT productDescription
                         FROM product_descriptions
                         WHERE product = soi.material
                         LIMIT 1
                       )
                       ,
                       'Not available'
                     ) AS productDescription
              FROM sales_order_items soi
              WHERE soi.salesOrder = ?
            `).all(salesOrder.salesOrder) as any[];

            result.flow.push({
              step: 5,
              entity: 'Sales Order Items',
              count: soItems.length,
              data: soItems
            });

            // Step 6: Customer
            const customer = db.prepare(`
              SELECT bp.*,
                     bpa.cityName,
                     bpa.country,
                     bpa.streetName,
                     bpa.postalCode
              FROM business_partners bp
              LEFT JOIN business_partner_addresses bpa
                ON bp.businessPartner = bpa.businessPartner
              WHERE bp.businessPartner = ?
            `).get(salesOrder.soldToParty) as any;

            // Always include the Customer step; some datasets may not have address rows.
            result.flow.push({
              step: 6,
              entity: 'Customer',
              status: customer ? 'Found' : 'Not available',
              data: customer ?? {}
            });
          }
        }
      }
    }

    // Step 7: Journal Entry (requires billing_header.accountingDocument)
    let journalEntries: any[] = [];
    let paymentClearingDocs: string[] = [];

    if (billingDoc?.accountingDocument) {
      // In this dataset, journal rows match billing by `journal_entry_items_ar.accountingDocument`.
      journalEntries = db.prepare(`
        SELECT * FROM journal_entry_items_ar
        WHERE accountingDocument = ?
        LIMIT 10
      `).all(billingDoc.accountingDocument) as any[];

      
      paymentClearingDocs = Array.from(
        new Set(
          journalEntries
            .map((j) => j.clearingAccountingDocument)
            .filter((v) => typeof v === 'string' && v.trim() !== '')
        )
      );

      if (journalEntries.length > 0) {
        result.flow.push({
          step: 7,
          entity: 'Journal Entry',
          count: journalEntries.length,
          data: journalEntries
        });
      } else {
        result.flow.push({
          step: 7,
          entity: 'Journal Entry',
          count: 0,
          data: []
        });
      }
    } else {
      result.flow.push({
        step: 7,
        entity: 'Journal Entry',
        status: 'Not available (missing billing header)',
        data: []
      });
    }

  
    if (billingDoc?.accountingDocument) {
      let payments: any[] = [];
      let paymentStatus = 'Pending';

      if (paymentClearingDocs.length > 0) {
        const placeholders = paymentClearingDocs.map(() => '?').join(',');
        payments = db
          .prepare(
            `SELECT * FROM payments_accounts_receivable
             WHERE clearingAccountingDocument IN (${placeholders})
             LIMIT 5`
          )
          .all(...paymentClearingDocs) as any[];
        paymentStatus = payments.length > 0 ? 'Cleared' : 'Pending';
      } else {
        // Journal entries exist, but the clearing key is blank, so we cannot link payments.
        paymentStatus = 'Not available (journal has no clearingAccountingDocument)';
      }

      result.flow.push({
        step: 8,
        entity: 'Payment',
        status: paymentStatus,
        data: payments
      });
    } else {
      result.flow.push({
        step: 8,
        entity: 'Payment',
        status: 'Not available (missing billing header)',
        data: []
      });
    }

    // Cancellation check
    const cancellation = db.prepare(`
      SELECT * FROM billing_document_cancellations
      WHERE billingDocument = ?
    `).get(docNumber) as any;

    if (cancellation) {
      result.flow.push({
        step: 9,
        entity: 'Cancellation',
        status: 'Cancelled',
        data: cancellation
      });
    }

    return result;
  }

  // ── Try Sales Order ─────────────────────────────────────────
  const salesOrder = db.prepare(`
    SELECT soh.*,
           COALESCE(bp.businessPartnerName, '') AS customerName
    FROM sales_order_headers soh
    LEFT JOIN business_partners bp
      ON soh.soldToParty = bp.businessPartner
    WHERE soh.salesOrder = ?
  `).get(docNumber) as any;

  if (salesOrder) {
    result.documentType = 'Sales Order';

    // Step 1: Sales Order Header
    result.flow.push({
      step: 1,
      entity: 'Sales Order',
      status: salesOrder.overallDeliveryStatus,
      data: salesOrder
    });

    // Step 2: Sales Order Items
    const soItems = db.prepare(`
      SELECT soi.*, COALESCE(pd.productDescription, 'Not available') AS productDescription
      FROM sales_order_items soi
      LEFT JOIN product_descriptions pd
        ON soi.material = pd.product AND pd.language = 'EN'
      WHERE soi.salesOrder = ?
    `).all(docNumber) as any[];

    result.flow.push({
      step: 2,
      entity: 'Sales Order Items',
      count: soItems.length,
      data: soItems
    });

    // Step 3: Customer
    const customer = db.prepare(`
      SELECT bp.*, bpa.cityName, bpa.country, bpa.streetName
      FROM business_partners bp
      LEFT JOIN business_partner_addresses bpa
        ON bp.businessPartner = bpa.businessPartner
      WHERE bp.businessPartner = ?
    `).get(salesOrder.soldToParty) as any;

    // Always include the Customer step to keep step numbering stable.
    result.flow.push({
      step: 3,
      entity: 'Customer',
      status: customer ? 'Found' : 'Not available',
      data: customer ?? {}
    });

    // Step 4: Delivery
    const deliveryLinks = db.prepare(`
      SELECT DISTINCT deliveryDocument
      FROM outbound_delivery_items
      WHERE referenceSdDocument = ?
    `).all(docNumber) as any[];

    if (deliveryLinks.length > 0) {
      const delivery = db.prepare(`
        SELECT * FROM outbound_delivery_headers
        WHERE deliveryDocument = ?
      `).get(deliveryLinks[0].deliveryDocument) as any;

      if (delivery) {
        result.flow.push({
          step: 4,
          entity: 'Outbound Delivery',
          status: delivery.overallGoodsMovementStatus,
          data: delivery
        });

        // Step 5: Billing
        const billingLinks = db.prepare(`
          SELECT DISTINCT billingDocument
          FROM billing_document_items
          WHERE referenceSdDocument = ?
        `).all(delivery.deliveryDocument) as any[];

        if (billingLinks.length > 0) {
          const billing = db.prepare(`
            SELECT * FROM billing_document_headers
            WHERE billingDocument = ?
          `).get(billingLinks[0].billingDocument) as any;

          if (billing) {
            result.flow.push({
              step: 5,
              entity: 'Billing Document',
              status: billing.billingDocumentIsCancelled
                ? 'Cancelled'
                : 'Active',
              data: billing
            });

            // Step 6: Journal Entry
            const journalEntries = db.prepare(`
              SELECT * FROM journal_entry_items_ar
              WHERE accountingDocument = ?
              LIMIT 10
            `).all(billing.accountingDocument) as any[];

            result.flow.push({
              step: 6,
              entity: 'Journal Entry',
              count: journalEntries.length,
              data: journalEntries
            });

            // Step 7: Payment (resolved via journal clearingAccountingDocument)
            const paymentClearingDocs = Array.from(
              new Set(
                journalEntries
                  .map((j) => j.clearingAccountingDocument)
                  .filter((v) => typeof v === 'string' && v.trim() !== '')
              )
            );

            let payments: any[] = [];
            if (paymentClearingDocs.length > 0) {
              const placeholders = paymentClearingDocs.map(() => '?').join(',');
              payments = db.prepare(`
                SELECT * FROM payments_accounts_receivable
                WHERE clearingAccountingDocument IN (${placeholders})
                LIMIT 10
              `).all(...paymentClearingDocs) as any[];
            }

            result.flow.push({
              step: 7,
              entity: 'Payment',
              status: payments.length > 0 ? 'Cleared' : 'Pending',
              data: payments
            });
          }
        } else {
          result.flow.push({
            step: 5,
            entity: 'Billing Document',
            status: 'Not Billed',
            data: []
          });

          result.flow.push({
            step: 6,
            entity: 'Journal Entry',
            status: 'Not available (not billed)',
            data: []
          });

          result.flow.push({
            step: 7,
            entity: 'Payment',
            status: 'Not available (not billed)',
            data: []
          });
        }
      }
    } else {
      result.flow.push({
        step: 4,
        entity: 'Outbound Delivery',
        status: 'Not Delivered',
        data: []
      });

      result.flow.push({
        step: 5,
        entity: 'Billing Document',
        status: 'Not Billed',
        data: []
      });

      result.flow.push({
        step: 6,
        entity: 'Journal Entry',
        status: 'Not available (not delivered)',
        data: []
      });

      result.flow.push({
        step: 7,
        entity: 'Payment',
        status: 'Not available (not delivered)',
        data: []
      });
    }

    return result;
  }

  return null;
}

// ================================================================
// SQL GENERATOR
// ================================================================
function generateFallbackSQL(question: string): string {
  const q = question.toLowerCase();
  const customerIdMatch = q.match(/\b(3\d{8})\b/);

  if (q.includes('how many sales orders') && q.includes('april') && q.includes('2025')) {
    return `
      SELECT COUNT(*) AS salesOrderCount
      FROM sales_order_headers
      WHERE substr(creationDate, 1, 7) = '2025-04'
    `;
  }

  if (q.includes('which customer has the most sales orders')) {
    return `
      SELECT
        soh.soldToParty AS customerId,
        COALESCE(bp.businessPartnerName, soh.soldToParty) AS customerName,
        COUNT(*) AS orderCount
      FROM sales_order_headers soh
      LEFT JOIN business_partners bp
        ON bp.businessPartner = soh.soldToParty
      GROUP BY soh.soldToParty, bp.businessPartnerName
      ORDER BY orderCount DESC
      LIMIT 1
    `;
  }

  if (q.includes('average order value')) {
    return `
      SELECT
        transactionCurrency,
        ROUND(AVG(totalNetAmount), 2) AS averageOrderValue,
        COUNT(*) AS orderCount
      FROM sales_order_headers
      GROUP BY transactionCurrency
      ORDER BY averageOrderValue DESC
    `;
  }

  if (
    q.includes('highest number of billing documents') ||
    (q.includes('products') && q.includes('billing'))
  ) {
    return `
      SELECT
        soi.material AS product,
        COALESCE(pd.productDescription, soi.material) AS productDescription,
        COUNT(DISTINCT bdi.billingDocument) AS billingDocumentCount
      FROM billing_document_items bdi
      JOIN sales_order_items soi
        ON soi.material = bdi.material
      LEFT JOIN product_descriptions pd
        ON pd.product = soi.material AND pd.language = 'EN'
      GROUP BY soi.material, pd.productDescription
      ORDER BY billingDocumentCount DESC
      LIMIT 10
    `;
  }

  if (
    q.includes('top 5 customers') ||
    (q.includes('customers') && q.includes('total order amount'))
  ) {
    return `
      SELECT
        soh.soldToParty AS customerId,
        COALESCE(bp.businessPartnerName, soh.soldToParty) AS customerName,
        SUM(soh.totalNetAmount) AS totalOrderAmount,
        soh.transactionCurrency,
        COUNT(*) AS orderCount
      FROM sales_order_headers soh
      LEFT JOIN business_partners bp
        ON bp.businessPartner = soh.soldToParty
      GROUP BY soh.soldToParty, bp.businessPartnerName, soh.transactionCurrency
      ORDER BY totalOrderAmount DESC
      LIMIT 5
    `;
  }

  if (
    q.includes('total revenue') ||
    (q.includes('revenue') && q.includes('billing'))
  ) {
    return `
      SELECT
        transactionCurrency,
        SUM(totalNetAmount) AS totalRevenue,
        COUNT(*) AS billingDocumentCount
      FROM billing_document_headers
      WHERE COALESCE(billingDocumentIsCancelled, 0) = 0
      GROUP BY transactionCurrency
      ORDER BY totalRevenue DESC
    `;
  }

  if (q.includes('top') && q.includes('products')) {
    return `
      SELECT
        soi.material AS product,
        COALESCE(
          MAX(CASE WHEN pd.language = 'EN' THEN pd.productDescription END),
          MAX(pd.productDescription),
          soi.material
        ) AS productDescription,
        ROUND(SUM(COALESCE(soi.netAmount, 0)), 2) AS totalSalesAmount
      FROM sales_order_items soi
      LEFT JOIN product_descriptions pd
        ON pd.product = soi.material
      GROUP BY soi.material
      ORDER BY totalSalesAmount DESC
      LIMIT 5
    `;
  }

  if (q.includes('cancelled billing')) {
    return `
      SELECT
        billingDocument,
        soldToParty,
        totalNetAmount,
        transactionCurrency,
        billingDocumentDate,
        cancelledBillingDocument
      FROM billing_document_cancellations
      LIMIT 50
    `;
  }

  if (q.includes('not been goods receipted') || q.includes('pending goods movement')) {
    return `
      SELECT
        deliveryDocument,
        creationDate,
        overallGoodsMovementStatus,
        overallPickingStatus,
        shippingPoint
      FROM outbound_delivery_headers
      WHERE COALESCE(overallGoodsMovementStatus, '') <> 'C'
      LIMIT 50
    `;
  }

  if (q.includes('plant handles the most deliveries')) {
    return `
      SELECT
        odi.plant,
        COUNT(DISTINCT odi.deliveryDocument) AS deliveryCount
      FROM outbound_delivery_items odi
      WHERE odi.plant IS NOT NULL AND odi.plant <> ''
      GROUP BY odi.plant
      ORDER BY deliveryCount DESC
      LIMIT 1
    `;
  }

  if (q.includes('how many customers are blocked')) {
    return `
      SELECT
        COUNT(*) AS blockedCustomerCount
      FROM business_partners
      WHERE businessPartnerIsBlocked = 1
         OR businessPartnerIsBlocked = '1'
         OR UPPER(COALESCE(CAST(businessPartnerIsBlocked AS TEXT), '')) = 'X'
    `;
  }

  if (q.includes('sales orders for customer') && customerIdMatch?.[1]) {
    return `
      SELECT
        salesOrder,
        soldToParty,
        creationDate,
        totalNetAmount,
        transactionCurrency,
        overallDeliveryStatus
      FROM sales_order_headers
      WHERE soldToParty = '${customerIdMatch[1]}'
      ORDER BY creationDate DESC
      LIMIT 100
    `;
  }

  if (q.includes('total unpaid amount') && q.includes('billing')) {
    return `
      SELECT
        bdh.transactionCurrency,
        ROUND(SUM(bdh.totalNetAmount), 2) AS totalUnpaidAmount,
        COUNT(*) AS unpaidInvoiceCount
      FROM billing_document_headers bdh
      WHERE COALESCE(bdh.billingDocumentIsCancelled, 0) = 0
        AND NOT EXISTS (
          SELECT 1
          FROM payments_accounts_receivable p
          WHERE p.clearingAccountingDocument = bdh.accountingDocument
        )
      GROUP BY bdh.transactionCurrency
      ORDER BY totalUnpaidAmount DESC
    `;
  }

  return 'SELECT * FROM sales_order_headers LIMIT 10';
}

async function generateSQL(question: string): Promise<string> {
  if (llmDisabledForProcess) {
    return generateFallbackSQL(question);
  }

  try {
    const { provider, geminiApiKey, geminiModel } = getLLMConfig();

    const prompt = `
You are an expert SQLite query generator for a SAP Order-to-Cash database.

${DB_SCHEMA}

RULES:
- Return ONLY the raw SQL query, nothing else
- No markdown formatting, no backticks, no explanations
- Use proper SQLite syntax only
- Always add LIMIT (max 100) unless it is a COUNT or SUM query
- Use LEFT JOIN when related data might not exist
- For aggregations use GROUP BY correctly
- Column names are case sensitive, use exact names from schema
- For broken flow queries use NOT EXISTS or LEFT JOIN ... IS NULL pattern

Question: "${question}"

SQL:
`;

    if (provider === 'groq') {
      const sql = await generateWithGroq(prompt, { maxTokens: 256, temperature: 0 });
      return sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });
    const result = await model.generateContent(prompt);
    let sql = result.response.text().trim();
    sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
    return sql;
  } catch (err) {
    if (isInvalidApiKeyError(err)) {
      disableLLMWithWarning(err);
    } else {
      console.error('LLM API Error in generateSQL:', err);
    }
    return generateFallbackSQL(question);
  }
}

// ================================================================
// SQL EXECUTOR
// ================================================================
function executeSQL(sql: string): { data: any[]; error?: string } {
  const db = getDb();

  const forbidden = /^\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i;
  if (forbidden.test(sql)) {
    return {
      data: [],
      error: 'Only SELECT queries are allowed.'
    };
  }

  try {
    const data = db.prepare(sql).all();
    return { data };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

// ================================================================
// RESULT SUMMARIZER
// ================================================================
async function summarizeResults(
  question: string,
  sql: string,
  data: any
): Promise<string> {
  if (llmDisabledForProcess) {
    const isArray = Array.isArray(data);
    const rowCount = isArray ? data.length : data?.flow?.length || 0;
    if (isArray && rowCount > 0) {
      if (typeof data[0] === 'object') {
        const keys = Object.keys(data[0]).slice(0, 3).join(', ');
        return `Found ${rowCount} result(s). Showing key fields: ${keys}.`;
      }
      return `Found ${rowCount} result(s) matching your query.`;
    }
    return `Retrieved ${rowCount} item(s) from the database.`;
  }

  try {
    const { provider, geminiApiKey, geminiModel } = getLLMConfig();

    const isArray = Array.isArray(data);
    const rowCount = isArray ? data.length : data?.flow?.length || 0;
    const preview = isArray
      ? JSON.stringify(data.slice(0, 15), null, 2)
      : JSON.stringify(data, null, 2).slice(0, 3000);

    const prompt = `
You are a helpful business analyst for a SAP Order-to-Cash system.

User asked: "${question}"

Query used: ${sql}

Result (${rowCount} items):
${preview}

Write a clear, concise answer in plain English:
- Highlight the key numbers, names, and insights
- If tracing a flow, describe each step in order
- If showing broken flows, explain what is missing
- Keep response under 200 words
- Do not mention SQL, tables, or technical database details
- Sound like a business analyst summarizing findings
`;

    if (provider === 'groq') {
      return generateWithGroq(prompt, { maxTokens: 400, temperature: 0.2 });
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    if (isInvalidApiKeyError(err)) {
      disableLLMWithWarning(err);
    } else {
      console.error('LLM API Error:', err);
    }
    // Fallback: return simple data summary when LLM fails
    const isArray = Array.isArray(data);
    const rowCount = isArray ? data.length : data?.flow?.length || 0;
    
    if (isArray && rowCount > 0) {
      return `Found ${rowCount} result(s) matching your query. Here's a summary of the data:\n\n${JSON.stringify(data.slice(0, 3), null, 2)}`;
    }
    
    return `Retrieved ${rowCount} items from the database.`;
  }
}

// ================================================================
// BROKEN FLOW QUERIES
// ================================================================
function getBrokenFlowSQL(question: string): string {
  const q = question.toLowerCase();

  if (q.includes('delivered') && q.includes('not billed')) {
    return `
      SELECT DISTINCT
        soh.salesOrder,
        soh.soldToParty,
        soh.totalNetAmount,
        soh.transactionCurrency,
        soh.creationDate,
        soh.overallDeliveryStatus,
        odh.deliveryDocument,
        odh.overallGoodsMovementStatus
      FROM sales_order_headers soh
      JOIN outbound_delivery_items odi
        ON odi.referenceSdDocument = soh.salesOrder
      JOIN outbound_delivery_headers odh
        ON odh.deliveryDocument = odi.deliveryDocument
      WHERE NOT EXISTS (
        SELECT 1 FROM billing_document_items bdi
        WHERE bdi.referenceSdDocument = odh.deliveryDocument
      )
      LIMIT 50
    `;
  }

  if (q.includes('billed') && q.includes('not paid')) {
    return `
      SELECT
        bdh.billingDocument,
        bdh.soldToParty,
        bdh.totalNetAmount,
        bdh.transactionCurrency,
        bdh.billingDocumentDate,
        bdh.accountingDocument
      FROM billing_document_headers bdh
      WHERE bdh.billingDocumentIsCancelled = 0
      AND NOT EXISTS (
        SELECT 1 FROM payments_accounts_receivable p
        WHERE p.clearingAccountingDocument = bdh.accountingDocument
      )
      LIMIT 50
    `;
  }

  if (
    q.includes('no delivery') ||
    (q.includes('sales order') && q.includes('not delivered'))
  ) {
    return `
      SELECT
        soh.salesOrder,
        soh.soldToParty,
        soh.totalNetAmount,
        soh.transactionCurrency,
        soh.creationDate,
        soh.overallDeliveryStatus
      FROM sales_order_headers soh
      WHERE NOT EXISTS (
        SELECT 1 FROM outbound_delivery_items odi
        WHERE odi.referenceSdDocument = soh.salesOrder
      )
      LIMIT 50
    `;
  }

  if (q.includes('cancelled')) {
    return `
      SELECT
        bdc.billingDocument,
        bdc.soldToParty,
        bdc.totalNetAmount,
        bdc.transactionCurrency,
        bdc.billingDocumentDate,
        bdc.cancelledBillingDocument
      FROM billing_document_cancellations bdc
      LIMIT 50
    `;
  }

  return '';
}

// ================================================================
// MAIN EXPORT
// ================================================================
export async function handleChatQuery(
  question: string
): Promise<ChatResponse> {

  // ── Step 1: Guardrail ───────────────────────────────────────
  const relevant = isDatasetRelated(question);
  if (!relevant) {
    return {
      answer:
        'This system is designed to answer questions related to the SAP Order-to-Cash dataset only. Please ask about sales orders, deliveries, invoices, payments, customers, or products.',
      isRelevant: false,
      queryType: 'BLOCKED'
    };
  }

  // ── Step 2: Detect query type ───────────────────────────────
  const queryType = detectQueryType(question);

  // ── Step 3: Handle TRACE FLOW ───────────────────────────────
  if (queryType === 'TRACE_FLOW') {
    const docMatch = question.match(/\b(\d{6,12})\b/);
    if (docMatch && docMatch[1]) {
      const flowData = traceDocumentFlow(docMatch[1]);
      if (flowData && flowData.flow.length > 0) {
        const answer = await summarizeResults(
          question,
          'TRACE_FLOW',
          flowData
        );
        return {
          answer,
          sql: 'TRACE_FLOW',
          data: flowData,
          isRelevant: true,
          queryType: 'TRACE_FLOW'
        };
      }
    }
    return {
      answer: 'I could not find that document number in the database. Please check the number and try again.',
      isRelevant: true,
      queryType: 'TRACE_FLOW'
    };
  }

  // ── Step 4: Handle BROKEN FLOW ──────────────────────────────
  if (queryType === 'BROKEN_FLOW') {
    const prebuiltSQL = getBrokenFlowSQL(question);
    const sql = prebuiltSQL || (await generateSQL(question));
    const { data, error } = executeSQL(sql);

    if (error || data.length === 0) {
      return {
        answer: error
          ? 'Could not execute that query. Try rephrasing.'
          : 'No broken flows found matching your criteria.',
        sql,
        data: [],
        isRelevant: true,
        queryType: 'BROKEN_FLOW'
      };
    }

    const answer = await summarizeResults(question, sql, data);
    return {
      answer,
      sql,
      data,
      isRelevant: true,
      queryType: 'BROKEN_FLOW'
    };
  }

  // ── Step 5: Handle GENERAL SQL query ───────────────────────
  const sql = await generateSQL(question);
  const { data, error } = executeSQL(sql);

  if (error) {
    // Retry once with error context
    const fixedSql = await generateSQL(
      `${question}\n\nThe previous SQL failed with: "${error}". Write a corrected SQLite query.`
    );
    const retry = executeSQL(fixedSql);

    if (retry.error || retry.data.length === 0) {
      return {
        answer: retry.data.length === 0
          ? 'No data found for your query. Try rephrasing or being more specific.'
          : 'Could not retrieve that data. Please try rephrasing your question.',
        sql: fixedSql,
        data: [],
        isRelevant: true,
        queryType: 'GENERAL'
      };
    }

    const answer = await summarizeResults(question, fixedSql, retry.data);
    return {
      answer,
      sql: fixedSql,
      data: retry.data,
      isRelevant: true,
      queryType: 'GENERAL'
    };
  }

  const answer = await summarizeResults(question, sql, data);
  return {
    answer,
    sql,
    data,
    isRelevant: true,
    queryType: 'GENERAL'
  };
}