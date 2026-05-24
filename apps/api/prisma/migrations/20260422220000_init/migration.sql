-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'READ_ONLY', 'STAFF');

-- CreateEnum
CREATE TYPE "SyncProvider" AS ENUM ('SERVICEM8', 'QUICKBOOKS', 'SUPPLIER_INBOX');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('MOCK', 'LIVE');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('AUTO_JOB_REFERENCE', 'AUTO_CUSTOMER_NAME', 'FUZZY_MATCH', 'MANUAL', 'SPLIT', 'IGNORED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'POSSIBLE_MATCH', 'UNMATCHED', 'MANUALLY_CONFIRMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('RECEIVED', 'PARSED', 'NEEDS_REVIEW', 'ASSIGNED', 'PARTIALLY_ASSIGNED', 'MANUALLY_CORRECTED', 'IGNORED', 'REMOVED', 'FAILED', 'POSSIBLE_DUPLICATE');

-- CreateEnum
CREATE TYPE "SupplierAllocationType" AS ENUM ('FULL_INVOICE', 'PARTIAL_AMOUNT', 'PERCENTAGE', 'LINE_ITEMS', 'MANUAL');

-- CreateEnum
CREATE TYPE "MaterialCostSource" AS ENUM ('DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8', 'SUPPLIER_INVOICES_ONLY', 'SERVICEM8_MANUAL_ONLY', 'SUPPLIER_PLUS_MANUAL', 'MANUAL_DASHBOARD_OVERRIDE', 'HIGHER_OF_SUPPLIER_OR_SERVICEM8', 'EXCLUDE_TEMPORARILY');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "totpSecret" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "serviceM8JobId" TEXT,
  "jobName" TEXT NOT NULL,
  "jobNumber" TEXT,
  "customerName" TEXT NOT NULL,
  "customerId" TEXT,
  "address" TEXT,
  "status" TEXT NOT NULL,
  "jobDate" TIMESTAMP(3),
  "completionDate" TIMESTAMP(3),
  "createdAtServiceM8" TIMESTAMP(3),
  "updatedAtServiceM8" TIMESTAMP(3),
  "leadSource" TEXT,
  "jobType" TEXT,
  "materialsCostServiceM8" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subcontractorCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "estimatedHours" DECIMAL(10,2),
  "estimatedMaterials" DECIMAL(12,2),
  "quotedValue" DECIMAL(12,2),
  "totalTimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "materialCostSource" "MaterialCostSource" NOT NULL DEFAULT 'DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8',
  "manualMaterialOverride" DECIMAL(12,2),
  "manualMaterialAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "serviceM8Payload" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "quickBooksInvoiceId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerId" TEXT,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "totalExVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalIncVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL,
  "reference" TEXT,
  "memo" TEXT,
  "createdAtQuickBooks" TIMESTAMP(3),
  "updatedAtQuickBooks" TIMESTAMP(3),
  "quickBooksPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "quickBooksPaymentId" TEXT,
  "invoiceId" TEXT,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paymentMethod" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "quickBooksExpenseId" TEXT,
  "supplierName" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "category" TEXT,
  "dashboardCategory" TEXT NOT NULL,
  "description" TEXT,
  "amountExVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amountIncVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paymentStatus" TEXT,
  "reference" TEXT,
  "linkedCustomerName" TEXT,
  "linkedJobId" TEXT,
  "createdAtQuickBooks" TIMESTAMP(3),
  "updatedAtQuickBooks" TIMESTAMP(3),
  "quickBooksPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInvoiceMatch" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "matchType" "MatchType" NOT NULL,
  "confidenceScore" DOUBLE PRECISION,
  "status" "MatchStatus" NOT NULL DEFAULT 'POSSIBLE_MATCH',
  "manuallyConfirmedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobInvoiceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "serviceM8BookingId" TEXT,
  "jobId" TEXT NOT NULL,
  "staffId" TEXT,
  "staffName" TEXT NOT NULL,
  "startTime" TIMESTAMP(3),
  "endTime" TIMESTAMP(3),
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
  "id" TEXT NOT NULL,
  "serviceM8StaffId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "hourlyCostRate" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
  "id" TEXT NOT NULL,
  "supplierName" TEXT,
  "supplierEmail" TEXT,
  "invoiceNumber" TEXT,
  "invoiceDate" TIMESTAMP(3),
  "reference" TEXT,
  "netAmount" DECIMAL(12,2),
  "vatAmount" DECIMAL(12,2),
  "grossAmount" DECIMAL(12,2),
  "carriageNetAmount" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "extractionStatus" "SupplierInvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
  "extractionConfidence" DOUBLE PRECISION,
  "matchingConfidence" DOUBLE PRECISION,
  "reviewReason" TEXT,
  "sourceEmailId" TEXT,
  "sourceEmailSubject" TEXT,
  "sourceEmailReceivedAt" TIMESTAMP(3),
  "attachmentFilename" TEXT,
  "attachmentStoragePath" TEXT,
  "fileHash" TEXT,
  "assignedJobId" TEXT,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "isDuplicateSuspected" BOOLEAN NOT NULL DEFAULT false,
  "isIncludedInJobCosting" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLineItem" (
  "id" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "productCode" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,3),
  "unitPriceExVat" DECIMAL(12,2),
  "lineTotalExVat" DECIMAL(12,2),
  "vatRate" DECIMAL(5,2),
  "category" TEXT,
  "assignedJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceAllocation" (
  "id" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "amountExVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "allocationType" "SupplierAllocationType" NOT NULL,
  "percentage" DECIMAL(6,3),
  "notes" TEXT,
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierInvoiceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
  "id" TEXT NOT NULL,
  "source" "SyncProvider" NOT NULL,
  "status" "SyncRunStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "details" JSONB,
  "triggeredByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualOverride" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "userId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksCategoryMapping" (
  "id" TEXT NOT NULL,
  "quickBooksAccountName" TEXT NOT NULL,
  "quickBooksAccountType" TEXT NOT NULL,
  "dashboardCategory" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuickBooksCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "provider" "SyncProvider" NOT NULL,
  "mode" "SyncMode" NOT NULL DEFAULT 'MOCK',
  "status" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "realmId" TEXT,
  "baseUrl" TEXT,
  "lastCursor" TEXT,
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserPermission_userId_permissionKey_key" ON "UserPermission"("userId", "permissionKey");
CREATE INDEX "UserPermission_permissionKey_idx" ON "UserPermission"("permissionKey");
CREATE UNIQUE INDEX "Job_serviceM8JobId_key" ON "Job"("serviceM8JobId");
CREATE INDEX "Job_jobDate_idx" ON "Job"("jobDate");
CREATE INDEX "Job_completionDate_idx" ON "Job"("completionDate");
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_customerName_idx" ON "Job"("customerName");
CREATE INDEX "Job_leadSource_idx" ON "Job"("leadSource");
CREATE INDEX "Job_jobType_idx" ON "Job"("jobType");
CREATE INDEX "Job_jobNumber_idx" ON "Job"("jobNumber");
CREATE UNIQUE INDEX "Invoice_quickBooksInvoiceId_key" ON "Invoice"("quickBooksInvoiceId");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_customerName_idx" ON "Invoice"("customerName");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Payment_quickBooksPaymentId_key" ON "Payment"("quickBooksPaymentId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");
CREATE UNIQUE INDEX "Expense_quickBooksExpenseId_key" ON "Expense"("quickBooksExpenseId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_dashboardCategory_idx" ON "Expense"("dashboardCategory");
CREATE INDEX "Expense_accountName_idx" ON "Expense"("accountName");
CREATE INDEX "Expense_linkedJobId_idx" ON "Expense"("linkedJobId");
CREATE UNIQUE INDEX "JobInvoiceMatch_jobId_invoiceId_key" ON "JobInvoiceMatch"("jobId", "invoiceId");
CREATE INDEX "JobInvoiceMatch_invoiceId_status_idx" ON "JobInvoiceMatch"("invoiceId", "status");
CREATE INDEX "JobInvoiceMatch_jobId_status_idx" ON "JobInvoiceMatch"("jobId", "status");
CREATE INDEX "JobInvoiceMatch_matchType_idx" ON "JobInvoiceMatch"("matchType");
CREATE UNIQUE INDEX "TimeEntry_serviceM8BookingId_key" ON "TimeEntry"("serviceM8BookingId");
CREATE INDEX "TimeEntry_jobId_idx" ON "TimeEntry"("jobId");
CREATE INDEX "TimeEntry_staffId_idx" ON "TimeEntry"("staffId");
CREATE INDEX "TimeEntry_staffName_idx" ON "TimeEntry"("staffName");
CREATE UNIQUE INDEX "Staff_serviceM8StaffId_key" ON "Staff"("serviceM8StaffId");
CREATE INDEX "Staff_name_idx" ON "Staff"("name");
CREATE INDEX "Staff_active_idx" ON "Staff"("active");
CREATE INDEX "SupplierInvoice_extractionStatus_idx" ON "SupplierInvoice"("extractionStatus");
CREATE INDEX "SupplierInvoice_assignedJobId_idx" ON "SupplierInvoice"("assignedJobId");
CREATE INDEX "SupplierInvoice_supplierName_invoiceNumber_idx" ON "SupplierInvoice"("supplierName", "invoiceNumber");
CREATE INDEX "SupplierInvoice_fileHash_idx" ON "SupplierInvoice"("fileHash");
CREATE INDEX "SupplierInvoice_sourceEmailReceivedAt_idx" ON "SupplierInvoice"("sourceEmailReceivedAt");
CREATE INDEX "SupplierInvoiceLineItem_supplierInvoiceId_idx" ON "SupplierInvoiceLineItem"("supplierInvoiceId");
CREATE INDEX "SupplierInvoiceLineItem_assignedJobId_idx" ON "SupplierInvoiceLineItem"("assignedJobId");
CREATE INDEX "SupplierInvoiceAllocation_supplierInvoiceId_idx" ON "SupplierInvoiceAllocation"("supplierInvoiceId");
CREATE INDEX "SupplierInvoiceAllocation_jobId_idx" ON "SupplierInvoiceAllocation"("jobId");
CREATE INDEX "SyncLog_source_startedAt_idx" ON "SyncLog"("source", "startedAt");
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "ManualOverride_entityType_entityId_idx" ON "ManualOverride"("entityType", "entityId");
CREATE INDEX "ManualOverride_userId_idx" ON "ManualOverride"("userId");
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE UNIQUE INDEX "QuickBooksCategoryMapping_quickBooksAccountName_quickBooksAccountType_key" ON "QuickBooksCategoryMapping"("quickBooksAccountName", "quickBooksAccountType");
CREATE INDEX "QuickBooksCategoryMapping_dashboardCategory_idx" ON "QuickBooksCategoryMapping"("dashboardCategory");
CREATE UNIQUE INDEX "IntegrationConnection_provider_key" ON "IntegrationConnection"("provider");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_linkedJobId_fkey" FOREIGN KEY ("linkedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobInvoiceMatch" ADD CONSTRAINT "JobInvoiceMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobInvoiceMatch" ADD CONSTRAINT "JobInvoiceMatch_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobInvoiceMatch" ADD CONSTRAINT "JobInvoiceMatch_manuallyConfirmedByUserId_fkey" FOREIGN KEY ("manuallyConfirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_assignedJobId_fkey" FOREIGN KEY ("assignedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceLineItem" ADD CONSTRAINT "SupplierInvoiceLineItem_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceLineItem" ADD CONSTRAINT "SupplierInvoiceLineItem_assignedJobId_fkey" FOREIGN KEY ("assignedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceAllocation" ADD CONSTRAINT "SupplierInvoiceAllocation_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceAllocation" ADD CONSTRAINT "SupplierInvoiceAllocation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvoiceAllocation" ADD CONSTRAINT "SupplierInvoiceAllocation_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualOverride" ADD CONSTRAINT "ManualOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
