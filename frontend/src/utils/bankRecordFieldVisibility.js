import { isRepoAdmin } from "./permissions";

/** Bank record fields only repo admin (and bank users) should see. */
export const ADMIN_ONLY_BANK_RECORD_KEYS = new Set([
  "loanAccountNumber",
  "loanAmount",
  "branchName",
  "branchCode",
  "banker1Name",
  "banker1Phone",
  "banker2Name",
  "banker2Phone",
  "banker3Name",
  "banker3Phone",
]);

export const ADMIN_ONLY_BANK_RECORD_LABELS = new Set([
  "Loan Account",
  "Loan Amount",
  "Loan Number",
  "Branch",
  "Branch Code",
  "Bank",
  "1st bankar Name",
  "2nd bankar Name",
  "3rd bankar Name",
  "mobile no",
  "mobile no 1",
  "mobile no 2",
  "mobile no 3",
  "Banker contacts",
  "Uploaded by",
]);

export function shouldShowFullBankRecordFields(role) {
  return isRepoAdmin(role) || role === "BANK_ADMIN" || role === "BANK_PERSON";
}

export function isAdminOnlyBankRecordKey(key) {
  return ADMIN_ONLY_BANK_RECORD_KEYS.has(key);
}

export function isAdminOnlyBankRecordLabel(label) {
  const n = String(label || "").trim();
  if (ADMIN_ONLY_BANK_RECORD_LABELS.has(n)) return true;
  if (/bankar|banker/i.test(n) && /name|mobile|phone|contact/i.test(n)) return true;
  if (/^mobile no/i.test(n)) return true;
  if (/loan\s*(number|account|no)/i.test(n)) return true;
  if (/^branch/i.test(n) && !/address/i.test(n)) return true;
  return false;
}

export function filterBankRecordFieldsByRole(fields, role, opts = {}) {
  if (shouldShowFullBankRecordFields(role)) return fields;
  const { keyField = "key", labelField = "label" } = opts;
  return fields.filter((field) => {
    if (field[keyField] && isAdminOnlyBankRecordKey(field[keyField])) return false;
    if (field[labelField] && isAdminOnlyBankRecordLabel(field[labelField])) return false;
    return true;
  });
}

export function filterBankRecordExcelRows(rows, role) {
  if (shouldShowFullBankRecordFields(role)) return rows;
  return rows.filter((row) => !isAdminOnlyBankRecordLabel(row.label));
}
