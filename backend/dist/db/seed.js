import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTables } from './schema.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ✅ Update this path to point to your sap-o2c-data folder
const DATA_PATH = 'C:\\Users\\Chandan kumar\\Downloads\\sap-order-to-cash-dataset\\sap-o2c-data';
/** Default: backend/database.sqlite. Override with DATABASE_PATH. */
const envDbPath = process.env.DATABASE_PATH?.trim();
const DB_PATH = envDbPath
    ? path.isAbsolute(envDbPath)
        ? envDbPath
        : path.resolve(process.cwd(), envDbPath)
    : path.join(__dirname, '../../database.sqlite');
// Read all .jsonl files from a folder into an array of objects
function readJsonlFolder(folderName) {
    const folderPath = path.join(DATA_PATH, folderName);
    if (!fs.existsSync(folderPath)) {
        console.warn(`  ⚠️  Folder not found: ${folderName}`);
        return [];
    }
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    const records = [];
    for (const file of files) {
        const lines = fs.readFileSync(path.join(folderPath, file), 'utf-8')
            .split('\n').filter(l => l.trim());
        for (const line of lines) {
            try {
                records.push(JSON.parse(line));
            }
            catch { }
        }
    }
    console.log(`  📦 ${folderName}: ${records.length} records`);
    return records;
}
// Run all inserts inside a transaction for speed
function batchInsert(db, stmt, records, label = "batch") {
    let errorCount = 0;
    let insertAttempts = 0;
    let insertedChanges = 0;
    const run = db.transaction((rows) => {
        for (const row of rows) {
            insertAttempts++;
            try {
                // better-sqlite3 cannot bind raw booleans; convert them to 0/1.
                // (The dataset contains boolean fields for INTEGER columns.)
                const normalizedRow = row
                    ? Object.fromEntries(Object.entries(row).map(([k, v]) => {
                        if (typeof v === "boolean")
                            return [k, v ? 1 : 0];
                        return [k, v];
                    }))
                    : row;
                const info = stmt.run(normalizedRow);
                // better-sqlite3: `changes` tells us how many rows were affected.
                insertedChanges += info.changes || 0;
            }
            catch (err) {
                errorCount++;
                if (errorCount <= 5) {
                    // eslint-disable-next-line no-console
                    console.warn(`  [seed:${label}] insert error (${errorCount}/${rows.length}):`, err?.message ?? err);
                }
            }
        }
    });
    run(records);
    // eslint-disable-next-line no-console
    console.log(`  ↳ ${label}: insert attempted=${insertAttempts}, errors=${errorCount}, changes=${insertedChanges}`);
}
function seed() {
    console.log('🌱 Starting seed...\n');
    if (fs.existsSync(DB_PATH))
        fs.unlinkSync(DB_PATH);
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    createTables(db);
    console.log('');
    // ---------- SALES ORDER HEADERS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO sales_order_headers VALUES (
      @salesOrder, @salesOrderType, @salesOrganization, @distributionChannel,
      @organizationDivision, @salesGroup, @salesOffice, @soldToParty,
      @creationDate, @createdByUser, @lastChangeDateTime, @totalNetAmount,
      @overallDeliveryStatus, @overallOrdReltdBillgStatus,
      @overallSdDocReferenceStatus, @transactionCurrency, @pricingDate,
      @requestedDeliveryDate, @headerBillingBlockReason, @deliveryBlockReason,
      @incotermsClassification, @incotermsLocation1,
      @customerPaymentTerms, @totalCreditCheckStatus
    )`), readJsonlFolder('sales_order_headers'));
    // ---------- SALES ORDER ITEMS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO sales_order_items VALUES (
      @salesOrder, @salesOrderItem, @salesOrderItemCategory, @material,
      @requestedQuantity, @requestedQuantityUnit, @transactionCurrency,
      @netAmount, @materialGroup, @productionPlant, @storageLocation,
      @salesDocumentRjcnReason, @itemBillingBlockReason
    )`), readJsonlFolder('sales_order_items'));
    // ---------- SALES ORDER SCHEDULE LINES ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO sales_order_schedule_lines VALUES (
      @salesOrder, @salesOrderItem, @scheduleLine, @confirmedDeliveryDate,
      @orderQuantityUnit, @confdOrderQtyByMatlAvailCheck
    )`), readJsonlFolder('sales_order_schedule_lines'));
    // ---------- OUTBOUND DELIVERY HEADERS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO outbound_delivery_headers VALUES (
      @deliveryDocument, @actualGoodsMovementDate, @creationDate,
      @deliveryBlockReason, @hdrGeneralIncompletionStatus,
      @headerBillingBlockReason, @lastChangeDate,
      @overallGoodsMovementStatus, @overallPickingStatus,
      @overallProofOfDeliveryStatus, @shippingPoint
    )`), readJsonlFolder('outbound_delivery_headers'));
    // ---------- OUTBOUND DELIVERY ITEMS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO outbound_delivery_items VALUES (
      @deliveryDocument, @deliveryDocumentItem, @actualDeliveryQuantity,
      @batch, @deliveryQuantityUnit, @itemBillingBlockReason,
      @lastChangeDate, @plant, @referenceSdDocument,
      @referenceSdDocumentItem, @storageLocation
    )`), readJsonlFolder('outbound_delivery_items'));
    // ---------- BILLING DOCUMENT HEADERS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO billing_document_headers VALUES (
      @billingDocument, @billingDocumentType, @creationDate,
      @lastChangeDateTime, @billingDocumentDate, @billingDocumentIsCancelled,
      @cancelledBillingDocument, @totalNetAmount, @transactionCurrency,
      @companyCode, @fiscalYear, @accountingDocument, @soldToParty
    )`), readJsonlFolder('billing_document_headers'), 'billing_document_headers');
    // ---------- BILLING DOCUMENT ITEMS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO billing_document_items VALUES (
      @billingDocument, @billingDocumentItem, @material,
      @billingQuantity, @billingQuantityUnit, @netAmount,
      @transactionCurrency, @referenceSdDocument, @referenceSdDocumentItem
    )`), readJsonlFolder('billing_document_items'));
    // ---------- PRODUCT DESCRIPTIONS ----------
    // Needed for productDescription fields in the trace responses.
    batchInsert(db, db.prepare(`
      INSERT OR REPLACE INTO product_descriptions VALUES (
        @product, @language, @productDescription
      )
    `), readJsonlFolder('product_descriptions'), 'product_descriptions');
    // ---------- BILLING DOCUMENT CANCELLATIONS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO billing_document_cancellations VALUES (
      @billingDocument, @billingDocumentType, @creationDate,
      @lastChangeDateTime, @billingDocumentDate, @billingDocumentIsCancelled,
      @cancelledBillingDocument, @totalNetAmount, @transactionCurrency,
      @companyCode, @fiscalYear, @accountingDocument, @soldToParty
    )`), readJsonlFolder('billing_document_cancellations'));
    // ---------- PAYMENTS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO payments_accounts_receivable VALUES (
      @companyCode, @fiscalYear, @accountingDocument, @accountingDocumentItem,
      @clearingDate, @clearingAccountingDocument, @clearingDocFiscalYear,
      @amountInTransactionCurrency, @transactionCurrency,
      @amountInCompanyCodeCurrency, @companyCodeCurrency, @customer,
      @invoiceReference, @invoiceReferenceFiscalYear,
      @salesDocument, @salesDocumentItem, @postingDate, @documentDate,
      @assignmentReference, @glAccount, @financialAccountType,
      @profitCenter, @costCenter
    )`), readJsonlFolder('payments_accounts_receivable'));
    // ---------- JOURNAL ENTRIES ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO journal_entry_items_ar VALUES (
      @companyCode, @fiscalYear, @accountingDocument, @accountingDocumentItem,
      @glAccount, @referenceDocument, @costCenter, @profitCenter,
      @transactionCurrency, @amountInTransactionCurrency,
      @companyCodeCurrency, @amountInCompanyCodeCurrency,
      @postingDate, @documentDate, @accountingDocumentType,
      @assignmentReference, @lastChangeDateTime, @customer,
      @financialAccountType, @clearingDate,
      @clearingAccountingDocument, @clearingDocFiscalYear
    )`), readJsonlFolder('journal_entry_items_accounts_receivable'));
    // ---------- BUSINESS PARTNERS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO business_partners VALUES (
      @businessPartner, @customer, @businessPartnerCategory,
      @businessPartnerFullName, @businessPartnerGrouping,
      @businessPartnerName, @correspondenceLanguage, @createdByUser,
      @creationDate, @firstName, @formOfAddress, @industry,
      @lastChangeDate, @lastName, @organizationBpName1,
      @organizationBpName2, @businessPartnerIsBlocked, @isMarkedForArchiving
    )`), readJsonlFolder('business_partners'), 'business_partners');
    // ---------- BUSINESS PARTNER ADDRESSES ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO business_partner_addresses VALUES (
      @businessPartner, @addressId, @validityStartDate, @validityEndDate,
      @addressUuid, @addressTimeZone, @cityName, @country, @poBox,
      @postalCode, @region, @streetName, @taxJurisdiction, @transportZone
    )`), readJsonlFolder('business_partner_addresses'));
    // ---------- CUSTOMER COMPANY ASSIGNMENTS ----------
    batchInsert(db, db.prepare(`
    INSERT OR REPLACE INTO customer_company_assignments VALUES (
      @customer, @companyCode, @accountingClerk, @paymentBlockingReason,
      @paymentMethodsList, @paymentTerms, @reconciliationAccount,
      @deletionIndicator, @customerAccountGroup
    )`), readJsonlFolder('customer_company_assignments'));
    console.log('\n✅ Seed completed!');
}
seed();
//# sourceMappingURL=seed.js.map