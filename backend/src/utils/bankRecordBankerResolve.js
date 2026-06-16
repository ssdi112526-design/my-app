const { inferBankerContactsFromExcel } = require("./excelBankerInference");
const { readBankerFromExcelHeaders } = require("./readBankerFromExcelHeaders");
const { extractBankerFieldsFromExtra } = require("./bankRecordDisplayExtract");
const { listExcelColumnsInFileOrder } = require("../modules/uploads/excelParser");
const { normalizeHeader } = require("../modules/uploads/excelParser");
const {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  isLoanAccountValue,
  normalizeExcelPhoneValue,
  sanitizeBankerFieldValue,
} = require("./bankerValueUtils");

function isPlaceholder(val) {
  const t = String(val ?? "")
    .trim()
    .toUpperCase();
  return !t || t === "NA" || t === "N/A" || t === "-" || t === "NULL";
}

function isBankerNameNk(nk, label = "") {
  const text = `${nk} ${label}`.toLowerCase();
  if (/customer|borrower|cust\s*name|debtor/.test(text)) return false;
  if (/tbr|allocation|seasoning|flag|confirm/.test(text)) return false;
  if (!(text.includes("bankar") || text.includes("banker"))) return false;
  return (
    text.includes("name") ||
    /\b(1st|2nd|3rd|first|second|third)\s*(bankar|banker)/.test(text)
  );
}

function slotFromBankerNameNk(nk, label) {
  const text = `${nk} ${label}`.toLowerCase();
  if (/\b(1st|first)\b/.test(text)) return 1;
  if (/\b(2nd|second)\b/.test(text)) return 2;
  if (/\b(3rd|third)\b/.test(text)) return 3;
  return 0;
}

function slotFromMobileKey(key, label) {
  const k = String(key || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(k) || /mobile\s*no_3/.test(l)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(k) || /mobile\s*no_2/.test(l)) return 2;
  if (/^mobile\s*no$/.test(k) || /^mobile\s*no$/.test(l)) return 1;
  const m = k.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  return 0;
}

function formatPhoneDisplay(value) {
  if (isPlaceholder(value)) return "";
  return coerceBankerPhoneDisplay(value);
}

function resolveBankerSlotsFromExtra(extraFields = {}, caseDoc = {}) {
  const extra = extraFields && typeof extraFields === "object" ? extraFields : {};
  const cols = listExcelColumnsInFileOrder(extra);

  const out = {
    banker1Name: "",
    banker1Phone: "",
    banker2Name: "",
    banker2Phone: "",
    banker3Name: "",
    banker3Phone: "",
    loanNumber: caseDoc.loanAccountNumber || "",
  };

  for (const col of cols) {
    const nk = col.nk || normalizeHeader(col.label || col.key);
    const label = col.label || col.key;
    const val = String(col.value ?? "").trim();
    if (isPlaceholder(val)) continue;

    if (isBankerNameNk(nk, label)) {
      let slot = slotFromBankerNameNk(nk, label);
      if (!slot) slot = [1, 2, 3].find((s) => !out[`banker${s}Name`]) || 1;
      if (slot >= 1 && slot <= 3) {
        const name = coerceBankerNameDisplay(val);
        if (name) out[`banker${slot}Name`] = name;
      }
    }
  }

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const nk = col.nk || normalizeHeader(col.label || col.key);
    const label = col.label || col.key;
    if (!isBankerNameNk(nk, label)) continue;
    let slot = slotFromBankerNameNk(nk, label);
    if (!slot) slot = [1, 2, 3].find((s) => !out[`banker${s}Name`]) || 1;
    if (out[`banker${slot}Phone`]) continue;

    for (let j = i + 1; j < Math.min(cols.length, i + 4); j++) {
      const next = cols[j];
      const nnk = next.nk || normalizeHeader(next.label || next.key);
      const nlabel = next.label || next.key;
      if (isBankerNameNk(nnk, nlabel)) break;
      if (/loan|chassis|engine|vehicle|reg/i.test(nnk)) continue;
      const nextVal = String(next.value ?? "").trim();
      if (isPlaceholder(nextVal)) continue;
      const phone = formatPhoneDisplay(nextVal);
      if (phone) {
        out[`banker${slot}Phone`] = phone;
        break;
      }
    }
  }

  let mobileColIndex = 0;
  for (const col of cols) {
    const key = col.key || col.label;
    const label = col.label || col.key;
    const nk = col.nk || normalizeHeader(label);
    if (!/^mobile(\s+no)?/i.test(String(key)) && !/^mobile(\s+no)?/i.test(nk)) {
      continue;
    }
    let slot = slotFromMobileKey(key, label);
    if (!slot) {
      mobileColIndex += 1;
      slot = Math.min(mobileColIndex, 3);
    }
    const val = String(col.value ?? "").trim();
    if (isPlaceholder(val)) continue;
    const phone = formatPhoneDisplay(val);
    if (phone && !out[`banker${slot}Phone`]) {
      out[`banker${slot}Phone`] = phone;
    }
  }

  try {
    const inferred = inferBankerContactsFromExcel(extra, {
      mobileNumber: caseDoc.borrowerPhone || caseDoc.mobileNumber,
      customerName: caseDoc.borrowerName || caseDoc.customerName,
      loanAccountNumber: caseDoc.loanAccountNumber,
    });
    if (!out.banker1Name && inferred.contactPerson1Name) {
      out.banker1Name = inferred.contactPerson1Name;
    }
    if (!out.banker1Phone && inferred.contactPerson1Phone) {
      out.banker1Phone = inferred.contactPerson1Phone;
    }
    if (!out.banker2Name && inferred.contactPerson2Name) {
      out.banker2Name = inferred.contactPerson2Name;
    }
    if (!out.banker2Phone && inferred.contactPerson2Phone) {
      out.banker2Phone = inferred.contactPerson2Phone;
    }
    if (!out.banker3Name && inferred.contactPerson3Name) {
      out.banker3Name = inferred.contactPerson3Name;
    }
    if (!out.banker3Phone && inferred.contactPerson3Phone) {
      out.banker3Phone = inferred.contactPerson3Phone;
    }
    if (!out.loanNumber && inferred.loanNumber) out.loanNumber = inferred.loanNumber;
  } catch {
    /* optional */
  }

  return out;
}

function normalizeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

const BANKER_ALIASES = {
  banker1Name: ["1st bankar name", "1st banker name", "first bankar name", "first banker name"],
  banker1Phone: ["mobile no", "mobile no 1", "mobile no_1", "1st mobile no", "1st banker number"],
  banker2Name: ["2nd bankar name", "2nd banker name", "second bankar name", "second banker name"],
  banker2Phone: ["mobile no 2", "mobile no_2", "2nd mobile no", "2nd banker number"],
  banker3Name: ["3rd bankar name", "3rd banker name", "third bankar name", "third banker name"],
  banker3Phone: ["mobile no 3", "mobile no_3", "3rd mobile no", "3rd banker number"],
};

function pickBankerField(extra, aliases = []) {
  if (!extra || typeof extra !== "object") return "";
  const want = aliases.map((a) => normalizeKey(a));
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    const nk = normalizeKey(key);
    if (want.includes(nk)) {
      const text = String(val ?? "").trim();
      if (text && !isPlaceholder(text)) return text;
    }
  }
  return "";
}

function mergeBankerFields(...sources) {
  const out = {
    banker1Name: "",
    banker1Phone: "",
    banker2Name: "",
    banker2Phone: "",
    banker3Name: "",
    banker3Phone: "",
    loanNumber: "",
  };
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of Object.keys(out)) {
      const val = String(src[key] ?? "").trim();
      if (!val || isPlaceholder(val) || out[key]) continue;
      out[key] = sanitizeBankerFieldValue(key, val);
    }
  }
  return out;
}

function buildBankerSnapshot(extraFields, caseDoc = {}) {
  const fromPairs = extractBankerFieldsFromExtra(extraFields, caseDoc);
  const fromExcel = readBankerFromExcelHeaders(extraFields);
  const fromColumns = resolveBankerSlotsFromExtra(extraFields, caseDoc);
  const snap =
    extraFields?._bankerSnapshot && typeof extraFields._bankerSnapshot === "object"
      ? extraFields._bankerSnapshot
      : {};
  const fromAliases = {};
  for (const [key, aliases] of Object.entries(BANKER_ALIASES)) {
    fromAliases[key] = pickBankerField(extraFields, aliases);
  }
  return mergeBankerFields(fromPairs, fromExcel, fromColumns, snap, fromAliases);
}

module.exports = {
  resolveBankerSlotsFromExtra,
  buildBankerSnapshot,
};
