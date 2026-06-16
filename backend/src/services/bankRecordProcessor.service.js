/**
 * bankRecordProcessor.service.js
 *
 * Streams an Excel file from S3, parses rows in chunks,
 * and bulk-inserts into BankRecord collection.
 * Same architecture as uploadJobProcessor.service.js but for bank panel.
 */

const BankUploadBatch = require("../modules/bank/bankUploadBatch.model");
const BankRecord = require("../modules/bank/bankRecord.model");
const { iterateBankExcelFromS3 } = require("./bankExcelFromS3.service");
const { enrichParsedBankRow } = require("../utils/bankRecordFieldResolve");
const { sanitizeVehicleFromExcel } = require("../utils/vehicleExcelNormalize");

const MAX_FAILED_DETAILS = 200;

// ---------------------------------------------------------------------------
// Comprehensive column aliases covering common Indian bank Excel formats
// ---------------------------------------------------------------------------
const FIELD_ALIASES = {
  vehicleNumber: [
    "vehicle number", "vehicle no", "vehicle no.", "reg no", "reg no.",
    "registration number", "registration no", "registration no.",
    "vrn", "vehicle_number", "veh no", "veh. no", "veh number",
    "rc number", "rc no", "rc no.", "plate number", "plate no",
    "vehicle registration", "vehicle reg", "vehicle reg no",
    "regn no", "regn number", "regd no", "regd number",
  ],
  chassisNumber: [
    "chassis number", "chassis no", "chassis no.", "chassis",
    "vin", "vin number", "vin no", "frame number", "frame no",
    "chasis no", "chasis number",
  ],
  engineNumber: [
    "engine number", "engine no", "engine no.", "engine",
    "engine num", "eng no", "eng number",
  ],
  borrowerName: [
    "borrower name", "borrower", "customer name", "customer",
    "name", "debtor name", "debtor", "applicant name", "applicant",
    "account holder", "account holder name", "party name", "party",
    "client name", "client", "hp name", "hire purchaser",
    "borrower's name", "customer's name",
  ],
  borrowerPhone: [
    "borrower phone", "borrower mobile", "borrower contact",
    "customer mobile", "customer phone", "customer contact",
    "cust mobile", "cust phone", "applicant mobile", "applicant phone",
    "primary mobile", "registered mobile",
    "phone", "phone number", "phone no", "phone no.",
    "contact number", "contact no",
    "mob no", "mob number", "cell number", "cell no",
  ],
  borrowerAddress: [
    "borrower address", "address", "customer address",
    "residence address", "permanent address", "current address",
    "home address", "addr", "borrower addr",
  ],
  loanAccountNumber: [
    "loan account number", "loan account no", "loan account no.",
    "loan no", "loan no.", "loan number", "lan",
    "account number", "account no", "account no.",
    "agreement no", "agreement number", "agreement no.",
    "contract no", "contract number", "hp no", "hp number",
    "loan id", "loan_id", "acc no", "acc number",
    "loan acc no", "loan acc number", "lad", "lad no",
  ],
  loanAmount: [
    "loan amount", "loan amt", "principal", "principal amount",
    "disbursed amount", "disbursement amount", "sanctioned amount",
    "financed amount", "finance amount", "loan value",
  ],
  outstandingAmount: [
    "outstanding amount", "outstanding", "outstanding amt",
    "due amount", "due amt", "overdue amount", "overdue",
    "total outstanding", "total due", "pending amount",
    "balance amount", "balance", "os amount", "os amt",
    "total overdue", "amount due", "pending dues",
    "emi outstanding", "total payable",
  ],
  vehicleMake: [
    "vehicle make", "make", "brand", "vehicle brand",
    "manufacturer", "company", "vehicle company",
    "auto make", "veh make",
  ],
  vehicleModel: [
    "vehicle model", "model", "vehicle type", "type",
    "veh model", "auto model",
  ],
  vehicleYear: [
    "vehicle year", "year", "year of manufacture", "mfg year",
    "manufacturing year", "model year", "yom",
  ],
  branchName: [
    "branch name", "branch", "branch nm", "br name", "br",
    "bank branch", "lending branch",
  ],
  branchCode: [
    "branch code", "br code", "branch cd", "br cd",
  ],
};

// Strip special characters and spaces for fuzzy matching
function normalize(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// Build normalized alias lookup once
const NORMALIZED_ALIASES = {};
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  NORMALIZED_ALIASES[field] = aliases.map(normalize);
}

function matchFieldForLabel(label) {
  const h = String(label || "").trim().toLowerCase();
  if (!h || h.startsWith("_excel")) return null;
  const hn = normalize(h);

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  for (const [field, normAliases] of Object.entries(NORMALIZED_ALIASES)) {
    if (normAliases.includes(hn)) return field;
  }

  if (/bankar|banker/.test(h) && !/borrower/.test(h)) {
    return null;
  }

  const KEYWORD_MAP = [
    ["vehiclenumber", "vehicleNumber"], ["regno", "vehicleNumber"], ["regnumber", "vehicleNumber"],
    ["registrationno", "vehicleNumber"],
    ["chassis", "chassisNumber"], ["chasis", "chassisNumber"],
    ["engine", "engineNumber"],
    ["customername", "borrowerName"], ["borrowername", "borrowerName"], ["applicantname", "borrowerName"],
    ["borrower", "borrowerName"], ["customer", "borrowerName"], ["applicant", "borrowerName"],
    ["customermobile", "borrowerPhone"], ["borrowermobile", "borrowerPhone"],
    ["customerphone", "borrowerPhone"], ["phoneno", "borrowerPhone"],
    ["address", "borrowerAddress"],
    ["loannumber", "loanAccountNumber"], ["loanaccno", "loanAccountNumber"], ["loanno", "loanAccountNumber"],
    ["accountno", "loanAccountNumber"], ["agreementno", "loanAccountNumber"], ["lan", "loanAccountNumber"],
    ["outstanding", "outstandingAmount"], ["overdue", "outstandingAmount"], ["dueamt", "outstandingAmount"],
    ["loanamt", "loanAmount"], ["principal", "loanAmount"],
    ["branchname", "branchName"], ["branch", "branchName"],
    ["make", "vehicleMake"], ["model", "vehicleModel"],
    ["year", "vehicleYear"], ["mfgyear", "vehicleYear"],
  ];

  for (const [keyword, field] of KEYWORD_MAP) {
    if (hn.includes(keyword)) return field;
  }
  return null;
}

/** Map Excel storage keys (row object keys) → BankRecord fields */
function buildMapping(headerCols) {
  const map = {};
  for (const col of headerCols || []) {
    const storageKey = col.storageKey || col.label;
    const field = matchFieldForLabel(col.label);
    if (storageKey && field) {
      map[storageKey] = field;
    }
  }
  return map;
}

function normalizeRow(rawRow, mapping, headerCols) {
  const out = { extraFields: {} };

  if (headerCols?.length) {
    for (const col of headerCols) {
      const storageKey = col.storageKey || col.label;
      const text =
        rawRow[storageKey] != null ? String(rawRow[storageKey]).trim() : "";
      out.extraFields[storageKey] = text;
      const field = mapping[storageKey];
      if (field) {
        out[field] = text;
      }
    }
  } else {
    for (const [col, val] of Object.entries(rawRow)) {
      if (String(col).startsWith("_excel")) continue;
      const field = mapping[col];
      const text = val != null ? String(val).trim() : "";
      if (field) {
        out[field] = text;
      } else {
        out.extraFields[col] = text;
      }
    }
  }

  return enrichParsedBankRow(out, headerCols);
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

async function processBankUploadJob({ batchId, bankId, uploadedBy, s3Key, fileName }) {
  const batch = await BankUploadBatch.findById(batchId);
  if (!batch) return;

  try {
    let mapping = null;
    let totalRows = 0;
    const stats = { success: 0, failed: 0, duplicate: 0, failedDetails: [] };

    // Track duplicates within this file (vehicle number)
    const seenVehicles = new Set();
    const seenLoans = new Set();

    await iterateBankExcelFromS3(s3Key, fileName, async (chunk) => {
      const rows = Array.isArray(chunk?.rows) ? chunk.rows : [];
      const headerCols = chunk.headerCols || [];

      if (!mapping && headerCols.length) {
        mapping = buildMapping(headerCols);
      }

      const toInsert = [];

      for (const rawRow of rows) {
        totalRows++;
        try {
          const row = normalizeRow(rawRow, mapping || {}, headerCols);

          // Skip completely empty rows
          if (!row.borrowerName && !row.vehicleNumber && !row.loanAccountNumber) {
            stats.failed++;
            continue;
          }

          // Dedup within file
          const vKey = row.vehicleNumber?.replace(/\s/g, "").toUpperCase();
          const lKey = row.loanAccountNumber?.replace(/\s/g, "").toUpperCase();

          if (vKey && seenVehicles.has(vKey)) { stats.duplicate++; continue; }
          if (lKey && seenLoans.has(lKey)) { stats.duplicate++; continue; }

          if (vKey) seenVehicles.add(vKey);
          if (lKey) seenLoans.add(lKey);

          toInsert.push({
            bankId,
            uploadedBy,
            batchId: String(batchId),
            vehicleNumber: sanitizeVehicleFromExcel(row.vehicleNumber || ""),
            chassisNumber: row.chassisNumber || "",
            engineNumber: row.engineNumber || "",
            borrowerName: row.borrowerName || "",
            borrowerPhone: row.borrowerPhone || "",
            borrowerAddress: row.borrowerAddress || "",
            loanAccountNumber: row.loanAccountNumber || "",
            loanAmount: row.loanAmount ? Number(row.loanAmount) : null,
            outstandingAmount: row.outstandingAmount ? Number(row.outstandingAmount) : null,
            vehicleMake: row.vehicleMake || "",
            vehicleModel: row.vehicleModel || "",
            vehicleYear: row.vehicleYear || "",
            branchName: row.branchName || "",
            branchCode: row.branchCode || "",
            extraFields: row.extraFields || {},
          });
        } catch (rowErr) {
          stats.failed++;
          if (stats.failedDetails.length < MAX_FAILED_DETAILS) {
            stats.failedDetails.push({ rowNumber: totalRows + 1, reason: rowErr.message });
          }
        }
      }

      // Bulk insert this chunk
      if (toInsert.length > 0) {
        try {
          const res = await BankRecord.insertMany(toInsert, { ordered: false });
          stats.success += res.length;
        } catch (bulkErr) {
          if (bulkErr.writeErrors) {
            stats.success += toInsert.length - bulkErr.writeErrors.length;
            stats.failed += bulkErr.writeErrors.length;
          } else {
            stats.failed += toInsert.length;
          }
        }
      }

      // Save progress
      batch.processedRows = totalRows;
      batch.successRows = stats.success;
      batch.failedRows = stats.failed;
      batch.duplicateRows = stats.duplicate;
      await batch.save();
    });

    batch.status = "completed";
    batch.totalRows = totalRows;
    batch.processedRows = totalRows;
    batch.successRows = stats.success;
    batch.failedRows = stats.failed;
    batch.duplicateRows = stats.duplicate;
    batch.failedDetails = stats.failedDetails;
    await batch.save();

    console.log(`[BankUpload] Batch ${batchId} done: ${stats.success} inserted, ${stats.failed} failed, ${stats.duplicate} dupes`);
  } catch (err) {
    console.error(`[BankUpload] Batch ${batchId} failed:`, err.message);
    batch.status = "failed";
    batch.errorMessage = err.message;
    await batch.save();
  }
}

module.exports = { processBankUploadJob };
