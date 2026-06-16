import { buildCanonicalAdminFinancerRows } from "../constants/adminFinancerFields";
import { getBankerFieldsFromCase, normalizeExcelHeader, pickExcelField } from "./bankerExcelFields";
import { isBankerMobileValue, isLoanAccountValue } from "./bankerValueUtils";

export const EXCEL_COLUMN_ORDER_KEY = "_excelColumnOrder";

export { ADMIN_FINANCER_DISPLAY_FIELDS } from "../constants/adminFinancerFields";

export function isExcelMetaKey(key) {
  return String(key || "").startsWith("_");
}

export function isNormMirrorKey(key, excelFields) {
  const nk = normalizeExcelHeader(key);
  const raw = String(key).trim();
  if (!raw || raw.toLowerCase() !== nk) return false;
  return Object.keys(excelFields || {}).some((k) => {
    if (k === key) return false;
    return normalizeExcelHeader(k) === nk && String(k).trim().toLowerCase() !== nk;
  });
}

function collectExcelFieldKeys(excelFields = {}) {
  const keys = [];
  const seen = new Set();
  for (const key of Object.keys(excelFields)) {
    if (isExcelMetaKey(key) || isNormMirrorKey(key, excelFields)) continue;
    const nk = normalizeExcelHeader(key);
    if (seen.has(nk)) continue;
    seen.add(nk);
    keys.push(String(key).trim());
  }
  return keys;
}

/** Column headers from upload snapshot (used for storage, not admin card order). */
export function getExcelColumnOrder(excelFields = {}, options = {}) {
  const external = options.columnOrder || options.excelColumnOrder;
  if (Array.isArray(external) && external.length) {
    return external.map(String).filter(Boolean);
  }

  if (!excelFields || typeof excelFields !== "object") return [];
  const stored = excelFields[EXCEL_COLUMN_ORDER_KEY];
  if (Array.isArray(stored) && stored.length) {
    return stored.map(String).filter(Boolean);
  }

  return collectExcelFieldKeys(excelFields);
}

/** Walk columns in Excel file order (duplicate headers e.g. two "mobile no"). */
export function listExcelColumnsInFileOrder(excelFields = {}) {
  if (!excelFields || typeof excelFields !== "object") return [];
  const order = excelFields._excelColumnOrder;
  const keys = excelFields._excelColumnKeys;

  if (Array.isArray(order) && Array.isArray(keys) && keys.length === order.length) {
    const cols = [];
    for (let i = 0; i < order.length; i++) {
      const label = String(order[i] || "").trim();
      const key = String(keys[i] || "").trim();
      if (!label || key.startsWith("_")) continue;
      cols.push({
        key,
        label,
        nk: normalizeExcelHeader(label),
        value: String(excelFields[key] ?? "").trim(),
      });
    }
    return cols;
  }

  if (Array.isArray(order) && order.length) {
    const occ = {};
    const cols = [];
    for (const label of order) {
      if (!label || String(label).startsWith("_")) continue;
      const nk = normalizeExcelHeader(label);
      occ[nk] = (occ[nk] || 0) + 1;
      const storageKey = occ[nk] === 1 ? label : `${label}_${occ[nk]}`;
      cols.push({
        key: storageKey,
        label,
        nk,
        value: String(
          excelFields[storageKey] ?? (occ[nk] === 1 ? excelFields[label] : "") ?? ""
        ).trim(),
      });
    }
    return cols;
  }

  const cols = [];
  for (const [key, val] of Object.entries(excelFields)) {
    if (isExcelMetaKey(key)) continue;
    cols.push({
      key,
      label: key,
      nk: normalizeExcelHeader(key),
      value: String(val ?? "").trim(),
    });
  }
  return cols;
}

export function pickExcelCell(excelFields = {}, label = "") {
  if (!excelFields || typeof excelFields !== "object" || !label) return "";
  const direct = excelFields[label];
  if (direct != null) {
    const s = String(direct).trim();
    if (s) return s;
  }
  const want = String(label).trim().toLowerCase();
  for (const [key, val] of Object.entries(excelFields)) {
    if (isExcelMetaKey(key) || isNormMirrorKey(key, excelFields)) continue;
    if (String(key).trim().toLowerCase() === want) {
      const s = String(val ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

function isMobileHeader(nk) {
  return /^mobile(\s+no)?(\s+\d+)?$/.test(nk) || /^mob(\s+no)?/.test(nk);
}

function isLoanHeader(nk) {
  return (
    nk.includes("loan number") ||
    nk.includes("loan no") ||
    nk.includes("loan account") ||
    nk === "loan" ||
    nk === "lan" ||
    nk.includes("lan no") ||
    (nk.includes("agreement") && (nk.includes("no") || nk.includes("number")))
  );
}

function resolveLoanNumber(doc, e, bankers) {
  const candidates = [
    bankers.loanNumber,
    doc.loanAccountNumber,
    pickExcelField(e, [
      "loan number",
      "loan no",
      "lan",
      "lan no",
      "agreement number",
      "agreement no",
    ]),
  ];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s && isLoanAccountValue(s)) return s;
  }
  return "";
}

/** Fixed SK financer field list for admin UI + bank notify messages. */
export function buildAdminExcelDisplayRows(caseDoc = {}, options = {}) {
  const doc = caseDoc && typeof caseDoc === "object" ? caseDoc : {};
  const e = doc.excelFields || {};
  const bankers = getBankerFieldsFromCase(doc);
  const loanResolved = resolveLoanNumber(doc, e, bankers);
  return buildCanonicalAdminFinancerRows(doc, bankers, loanResolved, options);
}

/** Admin detail cards: fixed field order, empty shown as — */
export function buildAdminExcelOrderedRows(caseData = {}, { showEmpty = true } = {}) {
  return buildAdminExcelDisplayRows(caseData)
    .map(({ label, value }) => {
      const v = String(value ?? "").trim();
      if (!showEmpty && !v) return null;
      return { label, value: v || "—" };
    })
    .filter(Boolean);
}

export { isMobileHeader, isLoanHeader };
