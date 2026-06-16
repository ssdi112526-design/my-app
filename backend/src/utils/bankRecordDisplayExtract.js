const { normalizeHeader, listExcelColumnsInFileOrder } = require("../modules/uploads/excelParser");
const {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} = require("./bankerValueUtils");

function isPlaceholder(val) {
  const t = String(val ?? "")
    .trim()
    .toUpperCase();
  return !t || t === "NA" || t === "N/A" || t === "-" || t === "NULL";
}

function getRawExtraCellValue(extra, storageKey, label) {
  if (!extra || typeof extra !== "object") return "";
  const candidates = [storageKey, label].filter(Boolean);
  for (const c of candidates) {
    if (extra[c] != null && extra[c] !== "") {
      const s = String(extra[c]).trim();
      if (s) return s;
    }
  }
  const want = new Set(candidates.map((c) => normalizeHeader(c)));
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    if (want.has(normalizeHeader(key))) {
      const s = String(val ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

function isTbrColumn(nk, label, storageKey) {
  const text = `${nk} ${label} ${storageKey}`.toLowerCase();
  return /\btbr\b/.test(text) && !/bankar|banker/.test(text);
}

function bankerNameSlot(nk, label) {
  const text = `${nk} ${label}`.toLowerCase();
  if (!/bankar|banker/.test(text)) return 0;
  if (/mobile|phone/.test(text) && !/name/.test(text)) return 0;
  if (/\b(1st|first)\b/.test(text)) return 1;
  if (/\b(2nd|second)\b/.test(text)) return 2;
  if (/\b(3rd|third)\b/.test(text)) return 3;
  return 0;
}

function bankerPhoneSlot(storageKey, label) {
  const k = String(storageKey || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(k) || /mobile\s*no_3/.test(l)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(k) || /mobile\s*no_2/.test(l)) return 2;
  if (/^mobile\s*no$/.test(k) || /^mobile\s*no$/.test(l)) return 1;
  const m = k.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  return 0;
}

function extractBankerFieldsFromExtra(extra, caseDoc = {}) {
  const out = {
    banker1Name: "",
    banker1Phone: "",
    banker2Name: "",
    banker2Phone: "",
    banker3Name: "",
    banker3Phone: "",
    loanNumber: caseDoc.loanAccountNumber || "",
  };
  if (!extra || typeof extra !== "object") return out;

  const cols = listExcelColumnsInFileOrder(extra);
  let mobileSeq = 0;

  for (const col of cols) {
    const storageKey = col.key || col.label;
    const label = col.label || col.key;
    const nk = col.nk || normalizeHeader(label || storageKey);
    if (isTbrColumn(nk, label, storageKey)) continue;

    const raw = getRawExtraCellValue(extra, storageKey, label);
    if (isPlaceholder(raw)) continue;

    const nameSlot = bankerNameSlot(nk, label);
    if (nameSlot >= 1 && nameSlot <= 3) {
      const name = coerceBankerNameDisplay(raw);
      if (name) out[`banker${nameSlot}Name`] = name;
      continue;
    }

    const sk = String(storageKey || "").toLowerCase();
    if (/^mobile\s*no/i.test(sk) || /^mobile(\s+no)?/i.test(nk)) {
      if (/customer|borrower|debtor|cust/.test(nk)) continue;
      let slot = bankerPhoneSlot(storageKey, label);
      if (!slot) {
        mobileSeq += 1;
        slot = Math.min(mobileSeq, 3);
      }
      const phone = coerceBankerPhoneDisplay(raw);
      if (phone && !out[`banker${slot}Phone`]) {
        out[`banker${slot}Phone`] = phone;
      }
    }
  }

  return out;
}

module.exports = {
  extractBankerFieldsFromExtra,
  getRawExtraCellValue,
};
