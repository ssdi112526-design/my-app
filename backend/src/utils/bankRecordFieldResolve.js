const { sanitizeVehicleFromExcel } = require("./vehicleExcelNormalize");
const { buildBankerSnapshot } = require("./bankRecordBankerResolve");

const VEHICLE_KEY_RE = /veh|reg|rc|vrn|plate|registration/i;
const CHASSIS_KEY_RE = /chasis|chassis|vin|frame/i;
const PHONE_KEY_RE = /mobile|phone|contact|mob|cell/i;
const NAME_KEY_RE = /borrower|customer|applicant|debtor|party|name|holder/i;
const LOAN_KEY_RE = /loan\s*number|loan\s*no|loan\s*account|agreement|lan|lad|hp\s*no|contract/i;
const OUTSTANDING_KEY_RE = /outstanding|overdue|os\s*amt|due\s*amt|pos|principal\s*due/i;
const BRANCH_KEY_RE = /branch/i;
const ADDRESS_KEY_RE = /address|addr|location|city/i;
const BANKER_COL_RE = /bankar|banker/i;

function isBankerColumn(key) {
  return BANKER_COL_RE.test(String(key || ""));
}

function isEmptyValue(val) {
  const t = String(val ?? "")
    .trim()
    .toUpperCase();
  return !t || t === "NA" || t === "N/A" || t === "NULL" || t === "-" || t === "—";
}

function pickFromExtras(extraFields, keyRe, { excludeBanker = false } = {}) {
  if (!extraFields || typeof extraFields !== "object") return "";
  for (const [key, val] of Object.entries(extraFields)) {
    if (String(key).startsWith("_")) continue;
    if (excludeBanker && isBankerColumn(key)) continue;
    if (keyRe.test(key) && !isEmptyValue(val)) {
      return String(val).trim();
    }
  }
  return "";
}

function pickBorrowerName(extraFields) {
  if (!extraFields || typeof extraFields !== "object") return "";
  const priority = [
    /customer\s*name/i,
    /borrower\s*name/i,
    /applicant\s*name/i,
    /customer/i,
    /borrower/i,
    /^name$/i,
  ];
  for (const re of priority) {
    for (const [key, val] of Object.entries(extraFields)) {
      if (String(key).startsWith("_")) continue;
      if (isBankerColumn(key)) continue;
      if (/mobile|phone|contact/i.test(key)) continue;
      if (re.test(key) && !isEmptyValue(val)) {
        return String(val).trim();
      }
    }
  }
  return pickFromExtras(extraFields, NAME_KEY_RE, { excludeBanker: true });
}

function pickBorrowerPhone(extraFields) {
  const priority = [/customer\s*mobile/i, /borrower\s*mobile/i, /primary\s*mobile/i];
  for (const re of priority) {
    for (const [key, val] of Object.entries(extraFields)) {
      if (String(key).startsWith("_")) continue;
      if (isBankerColumn(key)) continue;
      if (re.test(key) && !isEmptyValue(val)) {
        return String(val).trim();
      }
    }
  }
  return pickFromExtras(extraFields, PHONE_KEY_RE, { excludeBanker: true });
}

/** Fill core fields from extra Excel columns when header mapping missed them. */
function enrichParsedBankRow(row, headerCols = []) {
  const out = { ...row, extraFields: { ...(row.extraFields || {}) } };

  if (out.vehicleNumber) {
    out.vehicleNumber = sanitizeVehicleFromExcel(out.vehicleNumber);
  }
  if (!out.vehicleNumber) {
    out.vehicleNumber = sanitizeVehicleFromExcel(
      pickFromExtras(out.extraFields, VEHICLE_KEY_RE)
    );
  }

  if (!out.borrowerName) {
    out.borrowerName = pickBorrowerName(out.extraFields);
  }
  if (!out.borrowerPhone) {
    out.borrowerPhone = pickBorrowerPhone(out.extraFields);
  }
  if (!out.loanAccountNumber) {
    out.loanAccountNumber = pickFromExtras(out.extraFields, LOAN_KEY_RE);
  }
  if (!out.chassisNumber) {
    out.chassisNumber = pickFromExtras(out.extraFields, CHASSIS_KEY_RE);
  }
  if (!out.borrowerAddress) {
    out.borrowerAddress = pickFromExtras(out.extraFields, ADDRESS_KEY_RE);
  }
  if (!out.branchName) {
    out.branchName = pickFromExtras(out.extraFields, BRANCH_KEY_RE);
  }
  if (out.outstandingAmount == null || out.outstandingAmount === "") {
    const os = pickFromExtras(out.extraFields, OUTSTANDING_KEY_RE);
    if (os && !isNaN(Number(String(os).replace(/,/g, "")))) {
      out.outstandingAmount = Number(String(os).replace(/,/g, ""));
    }
  }

  if (headerCols?.length) {
    out.extraFields._excelColumnOrder = headerCols.map((c) => c.label);
    out.extraFields._excelColumnKeys = headerCols.map(
      (c) => c.storageKey || c.label
    );
  }

  out.extraFields._bankerSnapshot = buildBankerSnapshot(out.extraFields, {
    borrowerPhone: out.borrowerPhone,
    borrowerName: out.borrowerName,
    loanAccountNumber: out.loanAccountNumber,
  });

  return out;
}

module.exports = {
  enrichParsedBankRow,
  pickFromExtras,
  isEmptyValue,
  isBankerColumn,
};
