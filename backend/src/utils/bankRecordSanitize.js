function isRepoAdminRole(role) {
  return role === "REPO_ADMIN";
}

function isBankRole(role) {
  return role === "BANK_ADMIN" || role === "BANK_PERSON";
}

function shouldShowFull(role) {
  return isRepoAdminRole(role) || isBankRole(role);
}

const ADMIN_ONLY_KEYS = new Set([
  "loanAccountNumber",
  "loanAmount",
  "branchName",
  "branchCode",
]);

function isAdminOnlyExtraLabel(label) {
  const n = String(label || "").trim();
  if (/bankar|banker/i.test(n)) return true;
  if (/^mobile no/i.test(n)) return true;
  if (/loan\s*(number|account|no)/i.test(n)) return true;
  if (/^branch/i.test(n) && !/address/i.test(n)) return true;
  return false;
}

/** Strip sensitive bank-record fields for agency staff / viewers. */
function sanitizeBankRecordForRole(record, role) {
  if (!record || shouldShowFull(role)) {
    return record?.toObject ? record.toObject() : record;
  }

  const doc = record.toObject ? record.toObject() : { ...record };
  for (const key of ADMIN_ONLY_KEYS) {
    if (key in doc) doc[key] = "";
  }

  if (doc.extraFields && typeof doc.extraFields === "object") {
    const extra = { ...doc.extraFields };
    const order = Array.isArray(extra._excelColumnOrder) ? extra._excelColumnOrder : [];
    const keys = Array.isArray(extra._excelColumnKeys) ? extra._excelColumnKeys : order;

    for (let i = 0; i < keys.length; i++) {
      const storageKey = keys[i];
      const label = order[i] || storageKey;
      if (isAdminOnlyExtraLabel(label) || isAdminOnlyExtraLabel(storageKey)) {
        extra[storageKey] = "";
      }
    }
    doc.extraFields = extra;
  }

  if (doc.uploadedBy && typeof doc.uploadedBy === "object") {
    doc.uploadedBy = {
      _id: doc.uploadedBy._id,
      name: doc.uploadedBy.name,
    };
  }

  return doc;
}

module.exports = {
  sanitizeBankRecordForRole,
  shouldShowFullBankRecord: shouldShowFull,
};
