-- Reproducible PostgreSQL schema generated from existing Mongoose models.
-- Runtime also applies the same DDL on startup (CREATE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "users" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT DEFAULT '',
  "fatherName" TEXT DEFAULT '',
  "address" TEXT DEFAULT '',
  "city" TEXT DEFAULT '',
  "district" TEXT DEFAULT '',
  "post" TEXT DEFAULT '',
  "agencyName" TEXT DEFAULT '',
  "dateOfBirth" TEXT DEFAULT '',
  "photoUrl" TEXT DEFAULT '',
  "pincode" TEXT DEFAULT '',
  "state" TEXT DEFAULT '',
  "bloodGroup" TEXT DEFAULT '',
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "companyId" VARCHAR(24) DEFAULT NULL,
  "bankId" VARCHAR(24) DEFAULT NULL,
  "branchName" TEXT DEFAULT '',
  "employeeNumber" TEXT DEFAULT '',
  "teamLeaderId" VARCHAR(24) DEFAULT NULL,
  "lastKnownLocation" JSONB,
  "isActive" BOOLEAN DEFAULT TRUE,
  "registrationSource" TEXT DEFAULT 'ADMIN',
  "lastLoginAt" TIMESTAMPTZ DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_bankId_idx" ON "users" ("bankId");
CREATE INDEX IF NOT EXISTS "users_teamLeaderId_idx" ON "users" ("teamLeaderId");

CREATE TABLE IF NOT EXISTS "companies" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyCode" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactPersonName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "ownerName" TEXT,
  "gstNumber" TEXT,
  "panNumber" TEXT,
  "aadhaarNumber" TEXT,
  "photoUrl" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'ACTIVE',
  "registrationSource" TEXT DEFAULT 'ADMIN',
  "paymentStatus" TEXT DEFAULT 'PAID',
  "paymentMethod" TEXT DEFAULT NULL,
  "paymentNote" TEXT DEFAULT '',
  "paymentMarkedAt" TIMESTAMPTZ DEFAULT NULL,
  "blockReason" TEXT DEFAULT NULL,
  "blockedAt" TIMESTAMPTZ DEFAULT NULL,
  "repoAdminUserId" VARCHAR(24) DEFAULT NULL,
  "createdBy" VARCHAR(24) DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "companies_companyCode_unique" ON "companies" ("companyCode");

CREATE TABLE IF NOT EXISTS "pending_repo_admin_phone_otps" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "verifiedAt" TIMESTAMPTZ DEFAULT NULL,
  "status" TEXT DEFAULT 'PENDING',
  "createdBy" VARCHAR(24) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "pending_repo_admin_phone_otps_phone_idx" ON "pending_repo_admin_phone_otps" ("phone");
CREATE INDEX IF NOT EXISTS "pending_repo_admin_phone_otps_expiresAt_idx" ON "pending_repo_admin_phone_otps" ("expiresAt");
CREATE INDEX IF NOT EXISTS "pending_repo_admin_phone_otps_createdBy_idx" ON "pending_repo_admin_phone_otps" ("createdBy");
CREATE INDEX IF NOT EXISTS "pending_repo_admin_phone_otps_compound_0" ON "pending_repo_admin_phone_otps" ("phone", "createdBy", "status");

CREATE TABLE IF NOT EXISTS "plans" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "name" TEXT NOT NULL,
  "tierId" TEXT DEFAULT NULL,
  "billingType" TEXT DEFAULT 'MONTHLY_FLAT',
  "durationMonths" INTEGER NOT NULL,
  "price" NUMERIC NOT NULL,
  "monthlyPrice" NUMERIC DEFAULT 0,
  "perConnectFee" NUMERIC DEFAULT 0,
  "maxUsers" INTEGER DEFAULT NULL,
  "currency" TEXT DEFAULT 'INR',
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS "subscriptions" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "planId" VARCHAR(24) NOT NULL,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  "tierId" TEXT DEFAULT 'free',
  "status" TEXT DEFAULT 'ACTIVE',
  "paymentStatus" TEXT DEFAULT 'UNPAID',
  "schemeBlocked" BOOLEAN DEFAULT FALSE,
  "blockedReason" TEXT DEFAULT NULL,
  "lastReminderSentAt" TIMESTAMPTZ DEFAULT NULL,
  "nextReminderAt" TIMESTAMPTZ DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS "payments" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "subscriptionId" VARCHAR(24) NOT NULL,
  "provider" TEXT DEFAULT 'RAZORPAY',
  "razorpayOrderId" TEXT DEFAULT NULL,
  "razorpayPaymentId" TEXT DEFAULT NULL,
  "razorpaySignature" TEXT DEFAULT NULL,
  "amount" NUMERIC NOT NULL,
  "currency" TEXT DEFAULT 'INR',
  "status" TEXT DEFAULT 'PENDING',
  "paidAt" TIMESTAMPTZ DEFAULT NULL,
  "meta" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS "repo_cases" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseCode" TEXT NOT NULL,
  "referenceNumber" TEXT,
  "loanAccountNumber" TEXT,
  "bankName" TEXT,
  "branchName" TEXT,
  "uploadBatchId" VARCHAR(24) DEFAULT NULL,
  "customerName" TEXT NOT NULL,
  "fatherName" TEXT,
  "mobileNumber" TEXT,
  "alternateMobileNumber" TEXT,
  "vehicleNumber" TEXT,
  "chassisNumber" TEXT,
  "engineNumber" TEXT,
  "vehicleType" TEXT,
  "vehicleModel" TEXT,
  "vehicleBrand" TEXT,
  "registrationState" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "district" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "emiAmount" NUMERIC DEFAULT 0,
  "dueAmount" NUMERIC DEFAULT 0,
  "totalOutstandingAmount" NUMERIC DEFAULT 0,
  "assignedToUserId" VARCHAR(24) DEFAULT NULL,
  "bucket" TEXT,
  "priority" TEXT DEFAULT 'MEDIUM',
  "repoStatus" TEXT DEFAULT 'NEW',
  "otpStatus" TEXT DEFAULT 'NOT_SENT',
  "blacklistStatus" TEXT DEFAULT 'NO',
  "confirmationStatus" TEXT DEFAULT 'PENDING',
  "lastActionAt" TIMESTAMPTZ DEFAULT NULL,
  "nextFollowUpAt" TIMESTAMPTZ DEFAULT NULL,
  "remarks" JSONB DEFAULT '[]'::jsonb,
  "fieldNotes" TEXT,
  "loadedShort" TEXT DEFAULT '',
  "loadedDetail" TEXT DEFAULT '',
  "excelFields" JSONB DEFAULT '{}'::jsonb,
  "contactPerson1Name" TEXT DEFAULT '',
  "contactPerson1Phone" TEXT DEFAULT '',
  "contactPerson2Name" TEXT DEFAULT '',
  "contactPerson2Phone" TEXT DEFAULT '',
  "contactPerson3Name" TEXT DEFAULT '',
  "contactPerson3Phone" TEXT DEFAULT '',
  "bankNotifyEmail1" TEXT DEFAULT '',
  "bankNotifyEmail2" TEXT DEFAULT '',
  "traceStatus" TEXT DEFAULT 'PENDING',
  "lastKnownLocation" JSONB,
  "caseTimeline" JSONB DEFAULT '[]'::jsonb,
  "createdBy" VARCHAR(24) NOT NULL,
  "updatedBy" VARCHAR(24) DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "repo_cases_companyId_idx" ON "repo_cases" ("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "repo_cases_caseCode_unique" ON "repo_cases" ("caseCode");
CREATE INDEX IF NOT EXISTS "repo_cases_loanAccountNumber_idx" ON "repo_cases" ("loanAccountNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_bankName_idx" ON "repo_cases" ("bankName");
CREATE INDEX IF NOT EXISTS "repo_cases_uploadBatchId_idx" ON "repo_cases" ("uploadBatchId");
CREATE INDEX IF NOT EXISTS "repo_cases_customerName_idx" ON "repo_cases" ("customerName");
CREATE INDEX IF NOT EXISTS "repo_cases_mobileNumber_idx" ON "repo_cases" ("mobileNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_vehicleNumber_idx" ON "repo_cases" ("vehicleNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_chassisNumber_idx" ON "repo_cases" ("chassisNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_engineNumber_idx" ON "repo_cases" ("engineNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_city_idx" ON "repo_cases" ("city");
CREATE INDEX IF NOT EXISTS "repo_cases_state_idx" ON "repo_cases" ("state");
CREATE INDEX IF NOT EXISTS "repo_cases_repoStatus_idx" ON "repo_cases" ("repoStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_otpStatus_idx" ON "repo_cases" ("otpStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_blacklistStatus_idx" ON "repo_cases" ("blacklistStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_confirmationStatus_idx" ON "repo_cases" ("confirmationStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_traceStatus_idx" ON "repo_cases" ("traceStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_compound_0" ON "repo_cases" ("companyId", "vehicleNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_compound_1" ON "repo_cases" ("companyId", "uploadBatchId");
CREATE INDEX IF NOT EXISTS "repo_cases_compound_2" ON "repo_cases" ("companyId", "loanAccountNumber");
CREATE INDEX IF NOT EXISTS "repo_cases_compound_3" ON "repo_cases" ("companyId", "repoStatus");
CREATE INDEX IF NOT EXISTS "repo_cases_compound_4" ON "repo_cases" ("companyId", "customerName");

CREATE TABLE IF NOT EXISTS "vehicle_loaded_notes" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "vehicleNumber" TEXT DEFAULT '',
  "chassisNumber" TEXT DEFAULT '',
  "loadedShort" TEXT DEFAULT '',
  "loadedDetail" TEXT DEFAULT '',
  "updatedBy" VARCHAR(24) DEFAULT NULL,
  "updatedByName" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "vehicle_loaded_notes_companyId_idx" ON "vehicle_loaded_notes" ("companyId");
CREATE INDEX IF NOT EXISTS "vehicle_loaded_notes_lookupKey_idx" ON "vehicle_loaded_notes" ("lookupKey");
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_loaded_notes_compound_0" ON "vehicle_loaded_notes" ("companyId", "lookupKey");

CREATE TABLE IF NOT EXISTS "upload_batches" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "fileName" TEXT NOT NULL,
  "storedFilePath" TEXT DEFAULT '',
  "storageLocation" TEXT DEFAULT 's3',
  "s3DatasetKey" TEXT DEFAULT '',
  "s3SearchIndexKey" TEXT DEFAULT '',
  "bankName" TEXT,
  "branchName" TEXT,
  "totalRows" INTEGER DEFAULT 0,
  "columnCount" INTEGER DEFAULT 0,
  "columnNames" JSONB DEFAULT '[]'::jsonb,
  "successRows" INTEGER DEFAULT 0,
  "failedRows" INTEGER DEFAULT 0,
  "skippedInvalidLoanRows" INTEGER DEFAULT 0,
  "duplicateRows" INTEGER DEFAULT 0,
  "failedDetails" JSONB DEFAULT '[]'::jsonb,
  "uploadedBy" VARCHAR(24) NOT NULL,
  "status" TEXT DEFAULT 'completed',
  "processedRows" INTEGER DEFAULT 0,
  "errorMessage" TEXT DEFAULT '',
  "queueJobId" TEXT DEFAULT '',
  "importMode" TEXT DEFAULT 'full',
  "importNote" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "upload_batches_companyId_idx" ON "upload_batches" ("companyId");
CREATE INDEX IF NOT EXISTS "upload_batches_bankName_idx" ON "upload_batches" ("bankName");
CREATE INDEX IF NOT EXISTS "upload_batches_branchName_idx" ON "upload_batches" ("branchName");
CREATE INDEX IF NOT EXISTS "upload_batches_status_idx" ON "upload_batches" ("status");

CREATE TABLE IF NOT EXISTS "confirmations" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseId" VARCHAR(24) NOT NULL,
  "requestNote" TEXT DEFAULT '',
  "traceMode" TEXT DEFAULT 'ONLINE',
  "shareChannel" TEXT DEFAULT NULL,
  "photos" JSONB DEFAULT '[]'::jsonb,
  "inventoryImages" JSONB DEFAULT '[]'::jsonb,
  "inventoryVideos" JSONB DEFAULT '[]'::jsonb,
  "inventoryPdfs" JSONB DEFAULT '[]'::jsonb,
  "inventorySubmittedAt" TIMESTAMPTZ DEFAULT NULL,
  "inventorySubmittedBy" VARCHAR(24) DEFAULT NULL,
  "inventoryRevisionRequested" BOOLEAN DEFAULT FALSE,
  "inventoryRevisionNote" TEXT DEFAULT '',
  "inventoryRevisionRequestedAt" TIMESTAMPTZ DEFAULT NULL,
  "inventoryConfirmedAt" TIMESTAMPTZ DEFAULT NULL,
  "inventoryConfirmedBy" VARCHAR(24) DEFAULT NULL,
  "requestedBy" VARCHAR(24) NOT NULL,
  "requestedByName" TEXT,
  "requestedByRole" TEXT,
  "requestedByPhone" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'PENDING',
  "finalAction" TEXT DEFAULT NULL,
  "reviewNote" TEXT DEFAULT '',
  "reviewedBy" VARCHAR(24) DEFAULT NULL,
  "reviewedAt" TIMESTAMPTZ DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "confirmations_companyId_idx" ON "confirmations" ("companyId");
CREATE INDEX IF NOT EXISTS "confirmations_caseId_idx" ON "confirmations" ("caseId");
CREATE INDEX IF NOT EXISTS "confirmations_status_idx" ON "confirmations" ("status");

CREATE TABLE IF NOT EXISTS "banks" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankName" TEXT NOT NULL,
  "bankCode" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT DEFAULT '',
  "address" TEXT DEFAULT '',
  "city" TEXT DEFAULT '',
  "state" TEXT DEFAULT '',
  "gstNumber" TEXT DEFAULT '',
  "panNumber" TEXT DEFAULT '',
  "branchName" TEXT DEFAULT '',
  "adminUserId" VARCHAR(24) DEFAULT NULL,
  "status" TEXT DEFAULT 'pending_payment',
  "registrationSource" TEXT DEFAULT 'SELF',
  "createdBy" VARCHAR(24) DEFAULT NULL,
  "activatedAt" TIMESTAMPTZ DEFAULT NULL,
  "lastPaymentAt" TIMESTAMPTZ DEFAULT NULL,
  "nextDueAt" TIMESTAMPTZ DEFAULT NULL,
  "paymentNote" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "banks_bankCode_unique" ON "banks" ("bankCode");
CREATE UNIQUE INDEX IF NOT EXISTS "banks_email_unique" ON "banks" ("email");

CREATE TABLE IF NOT EXISTS "bank_records" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankId" VARCHAR(24) NOT NULL,
  "uploadedBy" VARCHAR(24) NOT NULL,
  "batchId" TEXT DEFAULT NULL,
  "vehicleNumber" TEXT DEFAULT '',
  "chassisNumber" TEXT DEFAULT '',
  "engineNumber" TEXT DEFAULT '',
  "borrowerName" TEXT DEFAULT '',
  "borrowerPhone" TEXT DEFAULT '',
  "borrowerAddress" TEXT DEFAULT '',
  "loanAccountNumber" TEXT DEFAULT '',
  "loanAmount" NUMERIC DEFAULT NULL,
  "outstandingAmount" NUMERIC DEFAULT NULL,
  "vehicleMake" TEXT DEFAULT '',
  "vehicleModel" TEXT DEFAULT '',
  "vehicleYear" TEXT DEFAULT '',
  "branchName" TEXT DEFAULT '',
  "branchCode" TEXT DEFAULT '',
  "extraFields" JSONB DEFAULT '{}'::jsonb,
  "status" TEXT DEFAULT 'active',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "bank_records_bankId_idx" ON "bank_records" ("bankId");
CREATE INDEX IF NOT EXISTS "bank_records_uploadedBy_idx" ON "bank_records" ("uploadedBy");
CREATE INDEX IF NOT EXISTS "bank_records_batchId_idx" ON "bank_records" ("batchId");
CREATE INDEX IF NOT EXISTS "bank_records_compound_0" ON "bank_records" ("bankId", "uploadedBy");
CREATE INDEX IF NOT EXISTS "bank_records_compound_1" ON "bank_records" ("bankId", "vehicleNumber");

CREATE TABLE IF NOT EXISTS "bank_repo_links" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankPersonId" VARCHAR(24) NOT NULL,
  "bankId" VARCHAR(24) NOT NULL,
  "repoAdminId" VARCHAR(24) NOT NULL,
  "linkedBy" VARCHAR(24) DEFAULT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "bank_repo_links_bankPersonId_idx" ON "bank_repo_links" ("bankPersonId");
CREATE INDEX IF NOT EXISTS "bank_repo_links_bankId_idx" ON "bank_repo_links" ("bankId");
CREATE INDEX IF NOT EXISTS "bank_repo_links_repoAdminId_idx" ON "bank_repo_links" ("repoAdminId");
CREATE UNIQUE INDEX IF NOT EXISTS "bank_repo_links_compound_0" ON "bank_repo_links" ("bankPersonId", "repoAdminId");

CREATE TABLE IF NOT EXISTS "bank_upload_batches" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankId" VARCHAR(24) NOT NULL,
  "uploadedBy" VARCHAR(24) NOT NULL,
  "fileName" TEXT NOT NULL,
  "storedFilePath" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'processing',
  "totalRows" INTEGER DEFAULT 0,
  "processedRows" INTEGER DEFAULT 0,
  "successRows" INTEGER DEFAULT 0,
  "failedRows" INTEGER DEFAULT 0,
  "duplicateRows" INTEGER DEFAULT 0,
  "failedDetails" JSONB DEFAULT '[]'::jsonb,
  "errorMessage" TEXT DEFAULT '',
  "queueJobId" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "bank_upload_batches_bankId_idx" ON "bank_upload_batches" ("bankId");
CREATE INDEX IF NOT EXISTS "bank_upload_batches_uploadedBy_idx" ON "bank_upload_batches" ("uploadedBy");
CREATE INDEX IF NOT EXISTS "bank_upload_batches_status_idx" ON "bank_upload_batches" ("status");

CREATE TABLE IF NOT EXISTS "pending_bank_invites" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankPersonId" VARCHAR(24) NOT NULL,
  "bankId" VARCHAR(24) NOT NULL,
  "agencyEmail" TEXT DEFAULT '',
  "agencyName" TEXT DEFAULT '',
  "token" TEXT,
  "status" TEXT DEFAULT 'pending',
  "createdBy" VARCHAR(24) DEFAULT NULL,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_bank_invites_token_unique" ON "pending_bank_invites" ("token");

CREATE TABLE IF NOT EXISTS "data_usage_logs" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "bankRecordId" VARCHAR(24) NOT NULL,
  "uploadedBy" VARCHAR(24) NOT NULL,
  "bankId" VARCHAR(24) NOT NULL,
  "repoAdminId" VARCHAR(24) NOT NULL,
  "tracerId" VARCHAR(24) DEFAULT NULL,
  "status" TEXT DEFAULT 'active',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "data_usage_logs_bankRecordId_idx" ON "data_usage_logs" ("bankRecordId");
CREATE INDEX IF NOT EXISTS "data_usage_logs_uploadedBy_idx" ON "data_usage_logs" ("uploadedBy");
CREATE INDEX IF NOT EXISTS "data_usage_logs_bankId_idx" ON "data_usage_logs" ("bankId");
CREATE INDEX IF NOT EXISTS "data_usage_logs_repoAdminId_idx" ON "data_usage_logs" ("repoAdminId");
CREATE INDEX IF NOT EXISTS "data_usage_logs_tracerId_idx" ON "data_usage_logs" ("tracerId");
CREATE INDEX IF NOT EXISTS "data_usage_logs_compound_0" ON "data_usage_logs" ("uploadedBy", "status");
CREATE INDEX IF NOT EXISTS "data_usage_logs_compound_1" ON "data_usage_logs" ("bankId", "repoAdminId");

CREATE TABLE IF NOT EXISTS "notifications" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "userId" VARCHAR(24) NOT NULL,
  "type" TEXT DEFAULT 'RECORD_UPLOAD',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "meta" JSONB DEFAULT '{}'::jsonb,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "notifications_companyId_idx" ON "notifications" ("companyId");
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications" ("userId");
CREATE INDEX IF NOT EXISTS "notifications_compound_0" ON "notifications" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "blacklist_entries" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseId" VARCHAR(24) NOT NULL,
  "vehicleNumber" TEXT,
  "chassisNumber" TEXT,
  "customerName" TEXT,
  "reason" TEXT NOT NULL,
  "remarks" TEXT,
  "status" TEXT DEFAULT 'ACTIVE',
  "blacklistedBy" VARCHAR(24) NOT NULL,
  "blacklistedAt" TIMESTAMPTZ,
  "removedBy" VARCHAR(24) DEFAULT NULL,
  "removedAt" TIMESTAMPTZ DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "blacklist_entries_companyId_idx" ON "blacklist_entries" ("companyId");
CREATE INDEX IF NOT EXISTS "blacklist_entries_caseId_idx" ON "blacklist_entries" ("caseId");
CREATE INDEX IF NOT EXISTS "blacklist_entries_vehicleNumber_idx" ON "blacklist_entries" ("vehicleNumber");
CREATE INDEX IF NOT EXISTS "blacklist_entries_status_idx" ON "blacklist_entries" ("status");

CREATE TABLE IF NOT EXISTS "feedbacks" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "userId" VARCHAR(24) NOT NULL,
  "message" TEXT NOT NULL,
  "rating" NUMERIC NOT NULL,
  "subject" TEXT DEFAULT '',
  "category" TEXT DEFAULT 'GENERAL',
  "status" TEXT DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "feedbacks_companyId_idx" ON "feedbacks" ("companyId");
CREATE INDEX IF NOT EXISTS "feedbacks_userId_idx" ON "feedbacks" ("userId");

CREATE TABLE IF NOT EXISTS "finance_entries" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseId" VARCHAR(24) DEFAULT NULL,
  "type" TEXT NOT NULL,
  "amount" NUMERIC NOT NULL,
  "description" TEXT,
  "entryDate" TIMESTAMPTZ,
  "createdBy" VARCHAR(24) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "finance_entries_companyId_idx" ON "finance_entries" ("companyId");
CREATE INDEX IF NOT EXISTS "finance_entries_caseId_idx" ON "finance_entries" ("caseId");
CREATE INDEX IF NOT EXISTS "finance_entries_type_idx" ON "finance_entries" ("type");
CREATE INDEX IF NOT EXISTS "finance_entries_entryDate_idx" ON "finance_entries" ("entryDate");

CREATE TABLE IF NOT EXISTS "otp_logs" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseId" VARCHAR(24) NOT NULL,
  "mobileNumber" TEXT NOT NULL,
  "otpCode" TEXT,
  "sentAt" TIMESTAMPTZ,
  "verifiedAt" TIMESTAMPTZ DEFAULT NULL,
  "status" TEXT DEFAULT 'SENT',
  "provider" TEXT DEFAULT 'MANUAL',
  "remarks" TEXT,
  "createdBy" VARCHAR(24) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "otp_logs_companyId_idx" ON "otp_logs" ("companyId");
CREATE INDEX IF NOT EXISTS "otp_logs_caseId_idx" ON "otp_logs" ("caseId");
CREATE INDEX IF NOT EXISTS "otp_logs_status_idx" ON "otp_logs" ("status");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) DEFAULT NULL,
  "userId" VARCHAR(24) DEFAULT NULL,
  "userName" TEXT DEFAULT '',
  "role" TEXT DEFAULT '',
  "action" TEXT NOT NULL,
  "entity" TEXT DEFAULT '',
  "entityId" VARCHAR(24) DEFAULT NULL,
  "meta" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "audit_logs_companyId_idx" ON "audit_logs" ("companyId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_compound_0" ON "audit_logs" ("companyId", "createdAt");

CREATE TABLE IF NOT EXISTS "location_snapshots" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "caseId" VARCHAR(24) NOT NULL,
  "tracerId" VARCHAR(24) NOT NULL,
  "tracerName" TEXT DEFAULT '',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION DEFAULT NULL,
  "heading" DOUBLE PRECISION DEFAULT NULL,
  "speed" DOUBLE PRECISION DEFAULT NULL,
  "source" TEXT DEFAULT 'GPS',
  "note" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "location_snapshots_companyId_idx" ON "location_snapshots" ("companyId");
CREATE INDEX IF NOT EXISTS "location_snapshots_caseId_idx" ON "location_snapshots" ("caseId");
CREATE INDEX IF NOT EXISTS "location_snapshots_tracerId_idx" ON "location_snapshots" ("tracerId");
CREATE INDEX IF NOT EXISTS "location_snapshots_compound_0" ON "location_snapshots" ("caseId", "createdAt");

CREATE TABLE IF NOT EXISTS "company_banks" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "bankName" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  "branches" JSONB DEFAULT '[]'::jsonb,
  "createdBy" VARCHAR(24) NOT NULL,
  "updatedBy" VARCHAR(24) DEFAULT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "company_banks_companyId_idx" ON "company_banks" ("companyId");
CREATE INDEX IF NOT EXISTS "company_banks_bankName_idx" ON "company_banks" ("bankName");
CREATE UNIQUE INDEX IF NOT EXISTS "company_banks_compound_0" ON "company_banks" ("companyId", "bankName");

CREATE TABLE IF NOT EXISTS "user_phone_otps" (
  "_id" VARCHAR(24) PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "companyId" VARCHAR(24) NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "verifiedAt" TIMESTAMPTZ DEFAULT NULL,
  "status" TEXT DEFAULT 'PENDING',
  "createdBy" VARCHAR(24) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "user_phone_otps_phone_idx" ON "user_phone_otps" ("phone");
CREATE INDEX IF NOT EXISTS "user_phone_otps_companyId_idx" ON "user_phone_otps" ("companyId");
CREATE INDEX IF NOT EXISTS "user_phone_otps_expiresAt_idx" ON "user_phone_otps" ("expiresAt");
CREATE INDEX IF NOT EXISTS "user_phone_otps_compound_0" ON "user_phone_otps" ("phone", "companyId", "status");
