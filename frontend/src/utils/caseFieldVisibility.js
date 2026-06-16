import { isRepoAdmin } from "./permissions";

/** Case fields hidden from team leaders, office staff, repo staff, and viewers. */
export const ADMIN_ONLY_CASE_KEYS = new Set([
  "loanAccountNumber",
  "bankName",
  "branchName",
]);

export const ADMIN_ONLY_CASE_LABELS = new Set([
  "Loan Account Number",
  "Loan Account",
  "Bank Name",
  "Branch Name",
  "Bank",
  "Branch",
  "Bank / Branch",
  "Finance",
  "Branch (xlsx)",
  "Agreement No",
]);

export function shouldShowAdminOnlyCaseFields(role) {
  return isRepoAdmin(role);
}

export function isAdminOnlyCaseKey(key) {
  return ADMIN_ONLY_CASE_KEYS.has(key);
}

export function isAdminOnlyCaseLabel(label) {
  return ADMIN_ONLY_CASE_LABELS.has(label);
}

export function filterFieldsByRole(fields, role, { keyField = "key", labelField = "label" } = {}) {
  if (shouldShowAdminOnlyCaseFields(role)) return fields;
  return fields.filter((field) => {
    if (field[keyField] && isAdminOnlyCaseKey(field[keyField])) return false;
    if (field[labelField] && isAdminOnlyCaseLabel(field[labelField])) return false;
    return true;
  });
}

export function filterCaseFieldRows(rows, role) {
  if (shouldShowAdminOnlyCaseFields(role)) return rows;
  return rows.filter((row) => !isAdminOnlyCaseLabel(row.label));
}
