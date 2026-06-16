const { listExcelColumnsInFileOrder } = require("../modules/uploads/excelParser");
const { normalizeHeader } = require("../modules/uploads/excelParser");
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

function pickExcelCell(extra, label) {
  if (!extra || !label) return "";
  const direct = extra[label];
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const want = String(label).trim().toLowerCase();
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    if (String(key).trim().toLowerCase() === want) {
      const text = String(val ?? "").trim();
      if (text) return text;
    }
  }
  return "";
}

function pickExcelField(extra, aliases = []) {
  if (!extra || typeof extra !== "object") return "";
  const normAliases = aliases.map((a) => normalizeHeader(a));
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    const nk = normalizeHeader(key);
    if (normAliases.includes(nk)) {
      const text = String(val).trim();
      if (text) return text;
    }
  }
  return "";
}

function isNonBankerMetaColumn(nk, label = "") {
  const text = `${nk} ${label}`.toLowerCase();
  if (/\btbr\b/.test(text) && !/bankar|banker/.test(text)) return true;
  if (/^allocation\b/.test(text) || /^seasoning\b/.test(text)) return true;
  return false;
}

function slotFromBankerNameHeader(nk, label = "") {
  const text = `${nk} ${label}`.toLowerCase();
  if (!/bankar|banker/.test(text)) return 0;
  if (/mobile|phone|contact/.test(text) && !/name/.test(text)) return 0;
  if (/\b(1st|first)\b/.test(text)) return 1;
  if (/\b(2nd|second)\b/.test(text)) return 2;
  if (/\b(3rd|third)\b/.test(text)) return 3;
  return 0;
}

function slotFromMobileHeader(key, label = "") {
  const k = String(key || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(k) || /mobile\s*no_3/.test(l)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(k) || /mobile\s*no_2/.test(l)) return 2;
  if (/^mobile\s*no$/.test(k) || /^mobile\s*no$/.test(l)) return 1;
  const m = k.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  return 0;
}

function isBankerMobileNk(nk) {
  if (!nk) return false;
  if (/^mobile(\s+no)?(\s+\d+)?$/.test(nk)) return true;
  if (/banker.*mobile|mobile.*banker|bankar.*mobile/.test(nk)) return true;
  return false;
}

const DIRECT_EXACT_KEYS = {
  banker1Name: ["1st bankar Name", "1st banker Name"],
  banker1Phone: ["mobile no 1", "mobile no", "mobile no_1"],
  banker2Name: ["2nd bankar Name", "2nd banker Name"],
  banker2Phone: ["mobile no 2", "mobile no_2"],
  banker3Name: ["3rd bankar Name", "3rd banker Name"],
  banker3Phone: ["mobile no 3", "mobile no_3"],
};

const DIRECT_ALIASES = {
  banker1Name: ["1st bankar name", "1st banker name"],
  banker1Phone: ["mobile no", "mobile no 1", "mobile no_1"],
  banker2Name: ["2nd bankar name", "2nd banker name"],
  banker2Phone: ["mobile no 2", "mobile no_2"],
  banker3Name: ["3rd bankar name", "3rd banker name"],
  banker3Phone: ["mobile no 3", "mobile no_3"],
};

function readBankerFromExcelHeaders(extraFields = {}) {
  const extra = extraFields && typeof extraFields === "object" ? extraFields : {};
  const out = {
    banker1Name: "",
    banker1Phone: "",
    banker2Name: "",
    banker2Phone: "",
    banker3Name: "",
    banker3Phone: "",
  };

  for (const [field, keys] of Object.entries(DIRECT_EXACT_KEYS)) {
    for (const label of keys) {
      const raw = pickExcelCell(extra, label);
      if (!raw || isPlaceholder(raw)) continue;
      const val = field.endsWith("Phone")
        ? coerceBankerPhoneDisplay(raw)
        : coerceBankerNameDisplay(raw);
      if (val) {
        out[field] = val;
        break;
      }
    }
  }

  for (const [field, aliases] of Object.entries(DIRECT_ALIASES)) {
    if (out[field]) continue;
    const raw = pickExcelField(extra, aliases);
    if (!raw || isPlaceholder(raw)) continue;
    const val = field.endsWith("Phone")
      ? coerceBankerPhoneDisplay(raw)
      : coerceBankerNameDisplay(raw);
    if (val) out[field] = val;
  }

  const cols = listExcelColumnsInFileOrder(extra);
  let mobileSeq = 0;

  for (const col of cols) {
    const nk = col.nk || normalizeHeader(col.label || col.key);
    const label = col.label || col.key;
    const key = col.key || label;
    if (isNonBankerMetaColumn(nk, label)) continue;

    const raw = String(col.value ?? "").trim();
    if (!raw || isPlaceholder(raw)) continue;

    const nameSlot = slotFromBankerNameHeader(nk, label);
    if (nameSlot >= 1 && nameSlot <= 3) {
      const name = coerceBankerNameDisplay(raw);
      if (name) out[`banker${nameSlot}Name`] = name;
      continue;
    }

    if (isBankerMobileNk(nk) || /^mobile\s*no/i.test(String(key))) {
      if (/customer|borrower|debtor/.test(nk)) continue;
      let slot = slotFromMobileHeader(key, label);
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

module.exports = { readBankerFromExcelHeaders };
