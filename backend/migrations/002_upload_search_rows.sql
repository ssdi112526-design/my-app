-- FastRecovery upload search table
-- Applied on startup via ensureUploadSearchSchema() and this file for reproducibility.
-- Columns match the Excel worker payload + Find Vehicles search fields
-- (not assumed bank_id / registration_number / district — those are not on the upload path).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS upload_search_rows (
  "_id" VARCHAR(24) PRIMARY KEY,
  "companyId" VARCHAR(24) NOT NULL,
  "uploadBatchId" VARCHAR(24) NOT NULL,
  "sourceRowIndex" INTEGER NOT NULL,
  "customerName" TEXT,
  "mobileNumber" TEXT,
  "alternateMobileNumber" TEXT,
  "contactPerson1Phone" TEXT,
  "contactPerson2Phone" TEXT,
  "contactPerson3Phone" TEXT,
  "phoneDigits" TEXT,
  "loanAccountNumber" TEXT,
  "referenceNumber" TEXT,
  "vehicleNumber" TEXT,
  "chassisNumber" TEXT,
  "engineNumber" TEXT,
  "vehicleBrand" TEXT,
  "vehicleModel" TEXT,
  "addressLine1" TEXT,
  "bankName" TEXT,
  "branchName" TEXT,
  "city" TEXT,
  "state" TEXT,
  "bucket" TEXT,
  "emiAmount" NUMERIC,
  "dueAmount" NUMERIC,
  "totalOutstandingAmount" NUMERIC,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS upload_search_rows_companyId_idx
  ON upload_search_rows ("companyId");

CREATE INDEX IF NOT EXISTS upload_search_rows_uploadBatchId_idx
  ON upload_search_rows ("uploadBatchId");

CREATE UNIQUE INDEX IF NOT EXISTS upload_search_rows_batch_row_uidx
  ON upload_search_rows ("uploadBatchId", "sourceRowIndex");

-- Partial / contains search (Find Vehicles type=vehicleNumber, chassis, loan, customer, phone)
CREATE INDEX IF NOT EXISTS upload_search_rows_vehicle_trgm_idx
  ON upload_search_rows USING gin ("vehicleNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS upload_search_rows_chassis_trgm_idx
  ON upload_search_rows USING gin ("chassisNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS upload_search_rows_customer_trgm_idx
  ON upload_search_rows USING gin ("customerName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS upload_search_rows_loan_trgm_idx
  ON upload_search_rows USING gin ("loanAccountNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS upload_search_rows_phone_trgm_idx
  ON upload_search_rows USING gin ("phoneDigits" gin_trgm_ops);
