import Database from 'better-sqlite3';

export function createTables(db: Database.Database): void {
  db.exec(`

    -- ==========================
    -- SALES ORDERS
    -- ==========================
    CREATE TABLE IF NOT EXISTS sales_order_headers (
      salesOrder TEXT PRIMARY KEY,
      salesOrderType TEXT,
      salesOrganization TEXT,
      distributionChannel TEXT,
      organizationDivision TEXT,
      salesGroup TEXT,
      salesOffice TEXT,
      soldToParty TEXT,
      creationDate TEXT,
      createdByUser TEXT,
      lastChangeDateTime TEXT,
      totalNetAmount REAL,
      overallDeliveryStatus TEXT,
      overallOrdReltdBillgStatus TEXT,
      overallSdDocReferenceStatus TEXT,
      transactionCurrency TEXT,
      pricingDate TEXT,
      requestedDeliveryDate TEXT,
      headerBillingBlockReason TEXT,
      deliveryBlockReason TEXT,
      incotermsClassification TEXT,
      incotermsLocation1 TEXT,
      customerPaymentTerms TEXT,
      totalCreditCheckStatus TEXT
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      salesOrder TEXT,
      salesOrderItem TEXT,
      salesOrderItemCategory TEXT,
      material TEXT,
      requestedQuantity REAL,
      requestedQuantityUnit TEXT,
      transactionCurrency TEXT,
      netAmount REAL,
      materialGroup TEXT,
      productionPlant TEXT,
      storageLocation TEXT,
      salesDocumentRjcnReason TEXT,
      itemBillingBlockReason TEXT,
      PRIMARY KEY (salesOrder, salesOrderItem)
    );

    CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
      salesOrder TEXT,
      salesOrderItem TEXT,
      scheduleLine TEXT,
      confirmedDeliveryDate TEXT,
      orderQuantityUnit TEXT,
      confdOrderQtyByMatlAvailCheck REAL,
      PRIMARY KEY (salesOrder, salesOrderItem, scheduleLine)
    );

    -- ==========================
    -- DELIVERIES
    -- ==========================
    CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
      deliveryDocument TEXT PRIMARY KEY,
      actualGoodsMovementDate TEXT,
      creationDate TEXT,
      deliveryBlockReason TEXT,
      hdrGeneralIncompletionStatus TEXT,
      headerBillingBlockReason TEXT,
      lastChangeDate TEXT,
      overallGoodsMovementStatus TEXT,
      overallPickingStatus TEXT,
      overallProofOfDeliveryStatus TEXT,
      shippingPoint TEXT
    );

    CREATE TABLE IF NOT EXISTS outbound_delivery_items (
      deliveryDocument TEXT,
      deliveryDocumentItem TEXT,
      actualDeliveryQuantity REAL,
      batch TEXT,
      deliveryQuantityUnit TEXT,
      itemBillingBlockReason TEXT,
      lastChangeDate TEXT,
      plant TEXT,
      referenceSdDocument TEXT,
      referenceSdDocumentItem TEXT,
      storageLocation TEXT,
      PRIMARY KEY (deliveryDocument, deliveryDocumentItem)
    );

    -- ==========================
    -- BILLING DOCUMENTS
    -- ==========================
    CREATE TABLE IF NOT EXISTS billing_document_headers (
      billingDocument TEXT PRIMARY KEY,
      billingDocumentType TEXT,
      creationDate TEXT,
      lastChangeDateTime TEXT,
      billingDocumentDate TEXT,
      billingDocumentIsCancelled INTEGER,
      cancelledBillingDocument TEXT,
      totalNetAmount REAL,
      transactionCurrency TEXT,
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      soldToParty TEXT
    );

    CREATE TABLE IF NOT EXISTS billing_document_items (
      billingDocument TEXT,
      billingDocumentItem TEXT,
      material TEXT,
      billingQuantity REAL,
      billingQuantityUnit TEXT,
      netAmount REAL,
      transactionCurrency TEXT,
      referenceSdDocument TEXT,
      referenceSdDocumentItem TEXT,
      PRIMARY KEY (billingDocument, billingDocumentItem)
    );

    CREATE TABLE IF NOT EXISTS billing_document_cancellations (
      billingDocument TEXT PRIMARY KEY,
      billingDocumentType TEXT,
      creationDate TEXT,
      lastChangeDateTime TEXT,
      billingDocumentDate TEXT,
      billingDocumentIsCancelled INTEGER,
      cancelledBillingDocument TEXT,
      totalNetAmount REAL,
      transactionCurrency TEXT,
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      soldToParty TEXT
    );

    -- ==========================
    -- PAYMENTS & JOURNAL
    -- ==========================
    CREATE TABLE IF NOT EXISTS payments_accounts_receivable (
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      accountingDocumentItem TEXT,
      clearingDate TEXT,
      clearingAccountingDocument TEXT,
      clearingDocFiscalYear TEXT,
      amountInTransactionCurrency REAL,
      transactionCurrency TEXT,
      amountInCompanyCodeCurrency REAL,
      companyCodeCurrency TEXT,
      customer TEXT,
      invoiceReference TEXT,
      invoiceReferenceFiscalYear TEXT,
      salesDocument TEXT,
      salesDocumentItem TEXT,
      postingDate TEXT,
      documentDate TEXT,
      assignmentReference TEXT,
      glAccount TEXT,
      financialAccountType TEXT,
      profitCenter TEXT,
      costCenter TEXT,
      PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
    );

    CREATE TABLE IF NOT EXISTS journal_entry_items_ar (
      companyCode TEXT,
      fiscalYear TEXT,
      accountingDocument TEXT,
      accountingDocumentItem TEXT,
      glAccount TEXT,
      referenceDocument TEXT,
      costCenter TEXT,
      profitCenter TEXT,
      transactionCurrency TEXT,
      amountInTransactionCurrency REAL,
      companyCodeCurrency TEXT,
      amountInCompanyCodeCurrency REAL,
      postingDate TEXT,
      documentDate TEXT,
      accountingDocumentType TEXT,
      assignmentReference TEXT,
      lastChangeDateTime TEXT,
      customer TEXT,
      financialAccountType TEXT,
      clearingDate TEXT,
      clearingAccountingDocument TEXT,
      clearingDocFiscalYear TEXT,
      PRIMARY KEY (companyCode, fiscalYear, accountingDocument, accountingDocumentItem)
    );

    -- ==========================
    -- BUSINESS PARTNERS
    -- ==========================
    CREATE TABLE IF NOT EXISTS business_partners (
      businessPartner TEXT PRIMARY KEY,
      customer TEXT,
      businessPartnerCategory TEXT,
      businessPartnerFullName TEXT,
      businessPartnerGrouping TEXT,
      businessPartnerName TEXT,
      correspondenceLanguage TEXT,
      createdByUser TEXT,
      creationDate TEXT,
      firstName TEXT,
      formOfAddress TEXT,
      industry TEXT,
      lastChangeDate TEXT,
      lastName TEXT,
      organizationBpName1 TEXT,
      organizationBpName2 TEXT,
      businessPartnerIsBlocked INTEGER,
      isMarkedForArchiving INTEGER
    );

    CREATE TABLE IF NOT EXISTS business_partner_addresses (
      businessPartner TEXT,
      addressId TEXT,
      validityStartDate TEXT,
      validityEndDate TEXT,
      addressUuid TEXT,
      addressTimeZone TEXT,
      cityName TEXT,
      country TEXT,
      poBox TEXT,
      postalCode TEXT,
      region TEXT,
      streetName TEXT,
      taxJurisdiction TEXT,
      transportZone TEXT,
      PRIMARY KEY (businessPartner, addressId)
    );

    CREATE TABLE IF NOT EXISTS customer_company_assignments (
      customer TEXT,
      companyCode TEXT,
      accountingClerk TEXT,
      paymentBlockingReason TEXT,
      paymentMethodsList TEXT,
      paymentTerms TEXT,
      reconciliationAccount TEXT,
      deletionIndicator INTEGER,
      customerAccountGroup TEXT,
      PRIMARY KEY (customer, companyCode)
    );

    CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
      customer TEXT,
      salesOrganization TEXT,
      distributionChannel TEXT,
      division TEXT,
      billingIsBlockedForCustomer TEXT,
      completeDeliveryIsDefined INTEGER,
      creditControlArea TEXT,
      currency TEXT,
      customerPaymentTerms TEXT,
      deliveryPriority TEXT,
      incotermsClassification TEXT,
      incotermsLocation1 TEXT,
      salesGroup TEXT,
      salesOffice TEXT,
      shippingCondition TEXT,
      salesDistrict TEXT,
      exchangeRateType TEXT,
      PRIMARY KEY (customer, salesOrganization, distributionChannel, division)
    );

    -- ==========================
    -- PRODUCTS
    -- ==========================
    CREATE TABLE IF NOT EXISTS products (
      product TEXT PRIMARY KEY,
      productType TEXT,
      crossPlantStatus TEXT,
      crossPlantStatusValidityDate TEXT,
      creationDate TEXT,
      createdByUser TEXT,
      lastChangeDate TEXT,
      lastChangeDateTime TEXT,
      isMarkedForDeletion INTEGER,
      productOldId TEXT,
      grossWeight REAL,
      weightUnit TEXT,
      netWeight REAL,
      productGroup TEXT,
      baseUnit TEXT,
      division TEXT,
      industrySector TEXT
    );

    CREATE TABLE IF NOT EXISTS product_descriptions (
      product TEXT,
      language TEXT,
      productDescription TEXT,
      PRIMARY KEY (product, language)
    );

    CREATE TABLE IF NOT EXISTS product_plants (
      product TEXT,
      plant TEXT,
      countryOfOrigin TEXT,
      regionOfOrigin TEXT,
      availabilityCheckType TEXT,
      fiscalYearVariant TEXT,
      profitCenter TEXT,
      mrpType TEXT,
      PRIMARY KEY (product, plant)
    );

    CREATE TABLE IF NOT EXISTS product_storage_locations (
      product TEXT,
      plant TEXT,
      storageLocation TEXT,
      physicalInventoryBlockInd TEXT,
      dateOfLastPostedCntUnRstrcdStk TEXT,
      PRIMARY KEY (product, plant, storageLocation)
    );

    -- ==========================
    -- PLANTS
    -- ==========================
    CREATE TABLE IF NOT EXISTS plants (
      plant TEXT PRIMARY KEY,
      plantName TEXT,
      valuationArea TEXT,
      plantCustomer TEXT,
      plantSupplier TEXT,
      factoryCalendar TEXT,
      defaultPurchasingOrganization TEXT,
      salesOrganization TEXT,
      addressId TEXT,
      plantCategory TEXT,
      distributionChannel TEXT,
      division TEXT,
      language TEXT,
      isMarkedForArchiving INTEGER
    );

    -- ==========================
    -- INDEXES for fast JOINs
    -- ==========================
    CREATE INDEX IF NOT EXISTS idx_soh_soldToParty
      ON sales_order_headers(soldToParty);
    CREATE INDEX IF NOT EXISTS idx_soi_salesOrder
      ON sales_order_items(salesOrder);
    CREATE INDEX IF NOT EXISTS idx_soi_material
      ON sales_order_items(material);
    CREATE INDEX IF NOT EXISTS idx_odi_referenceSdDocument
      ON outbound_delivery_items(referenceSdDocument);
    CREATE INDEX IF NOT EXISTS idx_odi_deliveryDocument
      ON outbound_delivery_items(deliveryDocument);
    CREATE INDEX IF NOT EXISTS idx_bdh_soldToParty
      ON billing_document_headers(soldToParty);
    CREATE INDEX IF NOT EXISTS idx_bdh_accountingDocument
      ON billing_document_headers(accountingDocument);
    CREATE INDEX IF NOT EXISTS idx_bdi_referenceSdDocument
      ON billing_document_items(referenceSdDocument);
    CREATE INDEX IF NOT EXISTS idx_jnl_referenceDocument
      ON journal_entry_items_ar(referenceDocument);
    CREATE INDEX IF NOT EXISTS idx_jnl_customer
      ON journal_entry_items_ar(customer);
    CREATE INDEX IF NOT EXISTS idx_pay_customer
      ON payments_accounts_receivable(customer);
    CREATE INDEX IF NOT EXISTS idx_pay_clearingDoc
      ON payments_accounts_receivable(clearingAccountingDocument);
  `);

  console.log('✅ All tables and indexes created');
}