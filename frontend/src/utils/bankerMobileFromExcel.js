import { listExcelColumnsInFileOrder } from "./excelSheetDisplay";
import { normalizeExcelHeader } from "./bankerExcelFields";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  isBankerMobileValue,
  isLoanColumnKey,
  normalizeExcelPhoneValue,
} from "./bankerValueUtils";

function isBankerNameColumn(nk) {
  if (!nk) return false;
  if (nk.includes("mobile") || nk.includes("phone")) return false;
  if (!(nk.includes("bankar") || nk.includes("banker"))) return false;
  return nk.includes("name") || /\b(1st|2nd|3rd|first|second|third)\b/.test(nk);
}

export function isBankerMobileColumnNk(nk) {
  if (!nk) return false;
  if (isLoanColumnKey(nk)) return false;
  if (/^mobile(\s+no)?(\s+\d+)?$/.test(nk)) return true;
  if (/^mob(ile)?\s*no(\s+\d+)?$/.test(nk)) return true;
  if (/banker.*mobile|mobile.*banker|bankar.*mobile|mobile.*bankar/.test(nk)) return true;
  if (/\b(1st|2nd|3rd)\b.*\b(mobile|phone|contact)\b/.test(nk)) return true;
  return false;
}

/**
 * Resolve 1st / 2nd / 3rd banker mobiles from Excel layout:
 * column beside each banker name, then any mobile columns in file order.
 */
export function resolveBankerPhonesFromExcel(excelFields = {}, caseDoc = {}, bankers = {}) {
  const phones = [
    normalizeExcelPhoneValue(bankers.banker1Phone || caseDoc.contactPerson1Phone),
    normalizeExcelPhoneValue(bankers.banker2Phone || caseDoc.contactPerson2Phone),
    normalizeExcelPhoneValue(bankers.banker3Phone || caseDoc.contactPerson3Phone),
  ];

  const cols = listExcelColumnsInFileOrder(excelFields);
  if (!cols.length) return phones;

  let bankerNameIndex = 0;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const nk = col.nk || normalizeExcelHeader(col.label || col.key);

    if (isBankerNameColumn(nk) && col.value && coerceBankerNameDisplay(col.value)) {
      bankerNameIndex += 1;
      const slot = Math.min(bankerNameIndex, 3);
      if (phones[slot - 1]) continue;

      for (let j = i + 1; j < Math.min(cols.length, i + 4); j++) {
        const next = cols[j];
        const nnk = next.nk || normalizeExcelHeader(next.label || next.key);
        if (isBankerNameColumn(nnk) && coerceBankerNameDisplay(next.value)) break;
        if (isLoanColumnKey(nnk)) continue;

        const normalized = coerceBankerPhoneDisplay(next.value);
        if (normalized) {
          phones[slot - 1] = normalized;
          break;
        }
      }
    }
  }

  const usedLast10 = new Set(
    phones.filter(Boolean).map((p) => normalizeExcelPhoneValue(p).slice(-10))
  );

  const mobileCols = cols.filter(
    (c) => isBankerMobileColumnNk(c.nk) && coerceBankerPhoneDisplay(c.value)
  );
  let mi = 0;
  for (let s = 0; s < 3; s++) {
    if (phones[s]) continue;
    while (mi < mobileCols.length) {
      const normalized = coerceBankerPhoneDisplay(mobileCols[mi].value);
      mi += 1;
      if (!normalized) continue;
      const last10 = normalized.slice(-10);
      if (usedLast10.has(last10)) continue;
      phones[s] = normalized;
      usedLast10.add(last10);
      break;
    }
  }

  return phones;
}
