const { normalizeHeader } = require("../modules/uploads/excelParser");

const EXCEL_COLUMN_ORDER_KEY = "_excelColumnOrder";

function isExcelMetaKey(key) {
  return String(key || "").startsWith("_");
}

function isNormMirrorKey(key, excelFields) {
  const nk = normalizeHeader(key);
  const raw = String(key).trim();
  if (!raw || raw.toLowerCase() !== nk) return false;
  return Object.keys(excelFields || {}).some((k) => {
    if (k === key) return false;
    return normalizeHeader(k) === nk && String(k).trim().toLowerCase() !== nk;
  });
}

function getExcelColumnOrder(excelFields = {}, options = {}) {
  const external = options.columnOrder || options.excelColumnOrder;
  if (Array.isArray(external) && external.length) {
    return external.map(String).filter(Boolean);
  }

  if (!excelFields || typeof excelFields !== "object") return [];
  const stored = excelFields[EXCEL_COLUMN_ORDER_KEY];
  if (Array.isArray(stored) && stored.length) return stored.map(String);

  const keys = [];
  const seen = new Set();
  for (const key of Object.keys(excelFields)) {
    if (isExcelMetaKey(key) || isNormMirrorKey(key, excelFields)) continue;
    const nk = normalizeHeader(key);
    if (seen.has(nk)) continue;
    seen.add(nk);
    keys.push(String(key).trim());
  }
  return keys;
}

function pickExcelCell(excelFields = {}, label = "") {
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

function normalizeVehicleNumber(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

function formatVehicleNumberDisplay(value) {
  const normalized = normalizeVehicleNumber(value);
  const match = normalized.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (!match) return normalized || "";
  return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

module.exports = {
  EXCEL_COLUMN_ORDER_KEY,
  isExcelMetaKey,
  isNormMirrorKey,
  getExcelColumnOrder,
  pickExcelCell,
  isMobileHeader,
  isLoanHeader,
  normalizeVehicleNumber,
  formatVehicleNumberDisplay,
};
