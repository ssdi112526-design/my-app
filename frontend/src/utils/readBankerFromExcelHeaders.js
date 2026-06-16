import { listExcelColumnsInFileOrder, pickExcelCell } from "./excelSheetDisplay";
import { normalizeExcelHeader, pickExcelField } from "./bankerExcelFields";
import { isBankerMobileColumnNk } from "./bankerMobileFromExcel";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} from "./bankerValueUtils";

function isPlaceholder(val) {
  const t = String(val ?? "").trim().toUpperCase();
  return !t || t === "NA" || t === "N/A" || t === "-" || t === "NULL";
}

/** Skip TBR / allocation columns — not banker name/mobile columns. */
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
  if (/name/.test(text)) return 0;
  return 0;
}

function slotFromMobileHeader(key, label = "") {
  const k = String(key || "").toLowerCase();
  const l = String(label || "").toLowerCase();
  if (/mobile\s*no[\s_]*3\b/.test(k) || /mobile\s*no[\s_]*3\b/.test(l)) return 3;
  if (/mobile\s*no[\s_]*2\b/.test(k) || /mobile\s*no[\s_]*2\b/.test(l)) return 2;
  if (/mobile\s*no[\s_]*1\b/.test(k) || /mobile\s*no[\s_]*1\b/.test(l)) return 1;
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(k) || /mobile\s*no_3|mobile\s*no\s*3/.test(l)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(k) || /mobile\s*no_2|mobile\s*no\s*2/.test(l)) return 2;
  if (/^mobile\s*no$/.test(k) || /^mobile\s*no$/.test(l)) return 1;
  const m = k.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  if (/\b(1st|first)\b/.test(l) && /mobile|phone/.test(l)) return 1;
  if (/\b(2nd|second)\b/.test(l) && /mobile|phone/.test(l)) return 2;
  if (/\b(3rd|third)\b/.test(l) && /mobile|phone/.test(l)) return 3;
  return 0;
}

const DIRECT_EXACT_KEYS = {
  banker1Name: ["1st bankar Name", "1st banker Name", "1st Bankar Name"],
  banker1Phone: ["mobile no 1", "mobile no", "mobile no_1", "Mobile No"],
  banker2Name: ["2nd bankar Name", "2nd banker Name", "2nd Bankar Name"],
  banker2Phone: ["mobile no 2", "mobile no_2", "Mobile No_2"],
  banker3Name: ["3rd bankar Name", "3rd banker Name", "3rd Bankar Name"],
  banker3Phone: ["mobile no 3", "mobile no_3", "Mobile No_3"],
};

const DIRECT_ALIASES = {
  banker1Name: ["1st bankar name", "1st banker name", "first bankar name"],
  banker1Phone: ["mobile no", "mobile no 1", "mobile no_1", "1st mobile no"],
  banker2Name: ["2nd bankar name", "2nd banker name", "second bankar name"],
  banker2Phone: ["mobile no 2", "mobile no_2", "2nd mobile no"],
  banker3Name: ["3rd bankar name", "3rd banker name", "third bankar name"],
  banker3Phone: ["mobile no 3", "mobile no_3", "3rd mobile no"],
};

/**
 * Read banker names/phones directly from Excel column headers + storage keys.
 * Values come from the upload sheet columns only (not TBR/flag columns).
 */
export function readBankerFromExcelHeaders(extraFields = {}) {
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
      const val =
        field.endsWith("Phone")
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
    const nk = col.nk || normalizeExcelHeader(col.label || col.key);
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

    if (isBankerMobileColumnNk(nk) || /^mobile\s*no/i.test(String(key))) {
      if (/customer|borrower|cust\s*name|debtor/.test(nk)) continue;

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
