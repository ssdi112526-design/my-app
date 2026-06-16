import { listExcelColumnsInFileOrder } from "./excelSheetDisplay";
import { normalizeExcelHeader } from "./bankerExcelFields";
import {
  isBankerMobileColumnNk,
  resolveBankerPhonesFromExcel,
} from "./bankerMobileFromExcel";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  isLoanAccountValue,
} from "./bankerValueUtils";

function isPlaceholder(val) {
  const t = String(val ?? "").trim().toUpperCase();
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
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(k) || /mobile\s*no_3|mobile\s*no\s*3/.test(l)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(k) || /mobile\s*no_2|mobile\s*no\s*2/.test(l)) return 2;
  if (/^mobile\s*no$/.test(k) || /^mobile\s*no$/.test(l)) return 1;
  const m = k.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  return 0;
}

function formatPhoneDisplay(value) {
  if (isPlaceholder(value)) return "";
  return coerceBankerPhoneDisplay(value);
}

/**
 * Resolve 1st/2nd/3rd banker name + mobile from bank record extraFields (Excel column order).
 */
export function resolveBankerSlotsFromExtra(extraFields = {}, caseDoc = {}) {
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

  const snap = extra._bankerSnapshot;
  if (snap && typeof snap === "object") {
    for (const key of Object.keys(out)) {
      if (!snap[key] || isPlaceholder(snap[key])) continue;
      const val = String(snap[key]).trim();
      if (key.endsWith("Name")) {
        out[key] = coerceBankerNameDisplay(val);
        continue;
      }
      if (key.endsWith("Phone")) {
        out[key] = coerceBankerPhoneDisplay(val);
        continue;
      }
      out[key] = val;
    }
  }

  for (const col of cols) {
    const nk = col.nk || normalizeExcelHeader(col.label || col.key);
    const label = col.label || col.key;
    const val = String(col.value ?? "").trim();
    if (isPlaceholder(val)) continue;

    if (isBankerNameNk(nk, label)) {
      let slot = slotFromBankerNameNk(nk, label);
      if (!slot) {
        slot = [1, 2, 3].find((s) => !out[`banker${s}Name`]) || 1;
      }
      if (slot >= 1 && slot <= 3) {
        const name = coerceBankerNameDisplay(val);
        if (name) out[`banker${slot}Name`] = name;
      }
    }
  }

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const nk = col.nk || normalizeExcelHeader(col.label || col.key);
    const label = col.label || col.key;
    if (!isBankerNameNk(nk, label)) continue;
    let slot = slotFromBankerNameNk(nk, label);
    if (!slot) slot = [1, 2, 3].find((s) => !out[`banker${s}Name`]) || 1;
    if (out[`banker${slot}Phone`]) continue;

    for (let j = i + 1; j < Math.min(cols.length, i + 4); j++) {
      const next = cols[j];
      const nnk = next.nk || normalizeExcelHeader(next.label || next.key);
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

  // Assign 1st / 2nd / 3rd "mobile no" columns by file order when headers repeat.
  let mobileColIndex = 0;
  for (const col of cols) {
    const key = col.key || col.label;
    const label = col.label || col.key;
    const nk = col.nk || normalizeExcelHeader(label);
    if (!isBankerMobileColumnNk(nk) && !/^mobile\s*no/i.test(String(key))) continue;

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

  const phones = resolveBankerPhonesFromExcel(extra, caseDoc, out);
  out.banker1Phone = out.banker1Phone || phones[0] || "";
  out.banker2Phone = out.banker2Phone || phones[1] || "";
  out.banker3Phone = out.banker3Phone || phones[2] || "";

  for (const col of cols) {
    const nk = col.nk || normalizeExcelHeader(col.label || col.key);
    if (!/loan/i.test(nk) && !isLoanAccountValue(col.value)) continue;
    if (isLoanAccountValue(col.value) && !out.loanNumber) {
      out.loanNumber = String(col.value).trim();
    }
  }

  return out;
}
