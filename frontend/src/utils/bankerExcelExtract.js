import { normalizeExcelHeader } from "./bankerExcelFields";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  normalizeExcelPhoneValue,
} from "./bankerValueUtils";

export const BANKER_ROW_LABELS = [
  { key: "banker1Name", label: "1st bankar Name", slot: 1, type: "name" },
  { key: "banker1Phone", label: "mobile no 1", slot: 1, type: "phone" },
  { key: "banker2Name", label: "2nd bankar Name", slot: 2, type: "name" },
  { key: "banker2Phone", label: "mobile no 2", slot: 2, type: "phone" },
  { key: "banker3Name", label: "3rd bankar Name", slot: 3, type: "name" },
  { key: "banker3Phone", label: "mobile no 3", slot: 3, type: "phone" },
];

export function columnHaystack(col) {
  return `${col.sourceLabel || ""} ${col.label || ""} ${col.storageKey || ""}`.toLowerCase();
}

export function cellRaw(col) {
  if (!col) return "";
  const raw = String(col.rawValue ?? "").trim();
  if (raw) return raw;
  const formatted = String(col.value ?? "").trim();
  if (formatted && formatted !== "—") return formatted;
  return "";
}

export function isYnFlag(value) {
  return /^(y|n|yes|no)$/i.test(String(value ?? "").trim());
}

export function isTbrFlagValue(value) {
  const t = String(value ?? "").trim();
  if (!t) return false;
  if (isYnFlag(t)) return true;
  return /^tbr(\s+(yes|no))?$/i.test(t);
}

export function isTbrColumnHeader(col) {
  const h = columnHaystack(col);
  return /\btbr\b/.test(h) && !/bankar|banker/.test(h);
}

export function isBankerNameHeader(col) {
  const h = columnHaystack(col);
  if (isTbrColumnHeader(col)) return false;
  if (!/bankar|banker/.test(h)) return false;
  if (/mobile|phone/.test(h) && !/\bname\b/.test(h)) return false;
  return /\b(1st|2nd|3rd|first|second|third)\b/.test(h) || /\bname\b/.test(h);
}

export function isBankerMobileHeader(col) {
  const h = columnHaystack(col);
  if (isTbrColumnHeader(col)) return false;
  if (/customer|borrower|debtor|cust\s*name/.test(h)) return false;
  return /mobile\s*no|bankar.*mobile|banker.*mobile|confirmer.*mobile|contact.*mobile/.test(
    h
  );
}

export function isAlternateBankerNameHeader(col) {
  const h = columnHaystack(col);
  if (isTbrColumnHeader(col)) return false;
  if (/customer|borrower|debtor/.test(h)) return false;
  return (
    /confirmer|contact\s*person|bank\s*officer|recovery\s*officer|collection\s*officer/.test(
      h
    ) && /name/.test(h)
  );
}

export function isSkipColumnForPhoneScan(col) {
  const h = columnHaystack(col);
  return (
    /customer|borrower|debtor|cust\s*name|loan|chassis|engine|vehicle|reg|registration|tbr|allocation|seasoning/.test(
      h
    ) || isTbrColumnHeader(col)
  );
}

function nameSlotFromHeader(col) {
  const h = columnHaystack(col);
  if (/\b(1st|first)\b/.test(h)) return 1;
  if (/\b(2nd|second)\b/.test(h)) return 2;
  if (/\b(3rd|third)\b/.test(h)) return 3;
  return 0;
}

function mobileSlotFromHeader(col) {
  const sk = String(col.storageKey || "").toLowerCase();
  const h = columnHaystack(col);
  if (/mobile\s*no[\s_]*3\b/.test(sk) || /mobile\s*no[\s_]*3\b/.test(h)) return 3;
  if (/mobile\s*no[\s_]*2\b/.test(sk) || /mobile\s*no[\s_]*2\b/.test(h)) return 2;
  if (/mobile\s*no[\s_]*1\b/.test(sk) || /mobile\s*no[\s_]*1\b/.test(h)) return 1;
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(sk) || /mobile\s*no_3/.test(h)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(sk) || /mobile\s*no_2/.test(h)) return 2;
  if (/^mobile\s*no$/.test(sk) || /^mobile\s*no$/.test(h)) return 1;
  const m = sk.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  if (/\b(1st|first)\b/.test(h) && /mobile|phone/.test(h)) return 1;
  if (/\b(2nd|second)\b/.test(h) && /mobile|phone/.test(h)) return 2;
  if (/\b(3rd|third)\b/.test(h) && /mobile|phone/.test(h)) return 3;
  return 0;
}

/** Financer sheet layout: 1st bankar Name + mobile no 1, etc. (exact column pairing). */
const PAIRED_BANKER_SLOTS = [
  {
    slot: 1,
    nameMatch: (h) =>
      /\b(1st|first)\b/.test(h) && /bankar|banker/.test(h) && /name/.test(h),
    phoneMatch: (h) => /mobile\s*no[\s_]*1\b/.test(h) || /^mobile\s*no$/.test(h),
  },
  {
    slot: 2,
    nameMatch: (h) =>
      /\b(2nd|second)\b/.test(h) && /bankar|banker/.test(h) && /name/.test(h),
    phoneMatch: (h) => /mobile\s*no[\s_]*2\b/.test(h),
  },
  {
    slot: 3,
    nameMatch: (h) =>
      /\b(3rd|third)\b/.test(h) && /bankar|banker/.test(h) && /name/.test(h),
    phoneMatch: (h) => /mobile\s*no[\s_]*3\b/.test(h),
  },
];

function colMatches(col, matcher) {
  const h = columnHaystack(col);
  return matcher(h);
}

function pickPairedCell(cols, matcher) {
  for (const col of cols) {
    if (!matcher(col)) continue;
    return cellRaw(col);
  }
  return "";
}

/**
 * Read banker 1/2/3 from the same columns as the Excel sheet (name col + mobile no N col).
 * This is authoritative — avoids mixing slots when headers are "mobile no 1", "mobile no 2", …
 */
export function extractPairedBankerFromColumns(cols = []) {
  const names = { 1: "", 2: "", 3: "" };
  const phones = { 1: "", 2: "", 3: "" };

  for (const { slot, nameMatch, phoneMatch } of PAIRED_BANKER_SLOTS) {
    const nameRaw = pickPairedCell(cols, (c) => colMatches(c, nameMatch));
    const phoneRaw = pickPairedCell(cols, (c) => colMatches(c, phoneMatch));
    const name = coerceBankerNameDisplay(nameRaw);
    const phone = coerceBankerPhoneDisplay(phoneRaw);
    if (name) names[slot] = name;
    if (phone) phones[slot] = phone;
  }

  return { names, phones };
}

function isBankerRelatedLabel(nk) {
  return (
    /bankar|banker/.test(nk) ||
    /^mobile\s*no/.test(nk) ||
    /\btbr\b/.test(nk) ||
    /confirmer|contact\s*person/.test(nk)
  );
}

/** Format Excel grid cell — hide Y/N/TBR in banker-related columns. */
export function formatBankerAwareExcelCell(label, value) {
  const text = String(value ?? "").trim();
  if (!text || /^(na|n\/a|null|-)$/i.test(text)) return "—";

  const nk = normalizeExcelHeader(label);
  if (!isBankerRelatedLabel(nk)) return text;

  if (isYnFlag(text) || isTbrFlagValue(text)) return "—";
  if (/^mobile\s*no|mobile|phone/.test(nk) && !coerceBankerPhoneDisplay(text)) return "—";
  if (/name/.test(nk) && !coerceBankerNameDisplay(text)) return "—";
  if (/bankar|banker|confirmer|contact\s*person/.test(nk)) {
    const asName = coerceBankerNameDisplay(text);
    const asPhone = coerceBankerPhoneDisplay(text);
    if (asName) return asName;
    if (asPhone) return asPhone;
    return "—";
  }
  return text;
}

function scanNearbyName(cols, startIdx) {
  for (let j = startIdx; j >= Math.max(0, startIdx - 4); j--) {
    if (j !== startIdx && (isBankerNameHeader(cols[j]) || isAlternateBankerNameHeader(cols[j]))) {
      break;
    }
    const name = coerceBankerNameDisplay(cellRaw(cols[j]));
    if (name) return name;
  }
  for (let j = startIdx + 1; j < Math.min(cols.length, startIdx + 8); j++) {
    const col = cols[j];
    if (isBankerNameHeader(col) || isAlternateBankerNameHeader(col)) break;
    if (isTbrColumnHeader(col)) continue;
    const raw = cellRaw(col);
    if (isYnFlag(raw) || isTbrFlagValue(raw)) continue;
    const name = coerceBankerNameDisplay(raw);
    if (name) return name;
  }
  return "";
}

function fillOrphanNames(cols, names) {
  const used = new Set(
    Object.values(names)
      .filter(Boolean)
      .map((n) => n.toLowerCase())
  );
  for (const col of cols) {
    const h = columnHaystack(col);
    if (/customer|borrower|debtor|loan|chassis|engine|vehicle|reg|registration/.test(h)) {
      continue;
    }
    if (isTbrColumnHeader(col) && !/bankar|banker|confirmer|contact\s*person/.test(h)) {
      continue;
    }

    const name = coerceBankerNameDisplay(cellRaw(col));
    if (!name || used.has(name.toLowerCase())) continue;

    const slot = nameSlotFromHeader(col);
    if (slot && !names[slot]) {
      names[slot] = name;
      used.add(name.toLowerCase());
      continue;
    }

  }
}

function fillNamesBesidePhones(cols, names, phones) {
  for (let s = 1; s <= 3; s++) {
    if (names[s] || !phones[s]) continue;
    const want = normalizeExcelPhoneValue(phones[s]).slice(-10);
    if (!want) continue;

    for (let i = 0; i < cols.length; i++) {
      const phone = coerceBankerPhoneDisplay(cellRaw(cols[i]));
      if (!phone || normalizeExcelPhoneValue(phone).slice(-10) !== want) continue;

      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const col = cols[j];
        if (isBankerNameHeader(col) || isAlternateBankerNameHeader(col)) {
          const direct = coerceBankerNameDisplay(cellRaw(col));
          if (direct) {
            names[s] = direct;
            break;
          }
        }
        const raw = cellRaw(col);
        if (isYnFlag(raw) || isTbrFlagValue(raw)) continue;
        const name = coerceBankerNameDisplay(raw);
        if (name) {
          names[s] = name;
          break;
        }
      }
      if (names[s]) break;
    }
  }
}

function scanNearbyPhone(cols, startIdx) {
  for (let j = startIdx + 1; j < Math.min(cols.length, startIdx + 8); j++) {
    const col = cols[j];
    if (isBankerNameHeader(col) || isAlternateBankerNameHeader(col)) break;
    if (isTbrColumnHeader(col)) continue;
    const raw = cellRaw(col);
    if (isYnFlag(raw) || isTbrFlagValue(raw)) continue;
    const phone = coerceBankerPhoneDisplay(raw);
    if (phone) return phone;
  }
  return "";
}

/**
 * Extract banker names (text) and mobiles (10-digit numbers) from Excel columns.
 * Ignores Y/N/TBR flags; finds phones beside banker name columns.
 */
export function extractBankerContactsFromColumns(cols = []) {
  const paired = extractPairedBankerFromColumns(cols);
  const names = { ...paired.names };
  const phones = { ...paired.phones };
  let nameSeq = 0;

  const nameHeaders = (col) => isBankerNameHeader(col) || isAlternateBankerNameHeader(col);

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!nameHeaders(col)) continue;

    let slot = nameSlotFromHeader(col);
    if (!slot) {
      nameSeq += 1;
      slot = Math.min(nameSeq, 3);
    }

    if (!names[slot]) {
      let name = coerceBankerNameDisplay(cellRaw(col));
      if (!name) name = scanNearbyName(cols, i);
      if (name) names[slot] = name;
    }

    if (!phones[slot]) {
      const phone = scanNearbyPhone(cols, i);
      if (phone) phones[slot] = phone;
    }
  }

  let mobileSeq = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!isBankerMobileHeader(col)) continue;

    const raw = cellRaw(col);
    let phone = coerceBankerPhoneDisplay(raw);
    if (!phone && (isYnFlag(raw) || isTbrFlagValue(raw))) {
      phone = scanNearbyPhone(cols, i);
    }
    if (!phone) continue;

    let slot = mobileSlotFromHeader(col);
    if (!slot) {
      mobileSeq += 1;
      slot = Math.min(mobileSeq, 3);
    }
    if (!phones[slot]) phones[slot] = phone;
  }

  const usedPhones = new Set(
    Object.values(phones)
      .filter(Boolean)
      .map((p) => normalizeExcelPhoneValue(p).slice(-10))
  );
  const orphanPhones = [];
  for (const col of cols) {
    if (isSkipColumnForPhoneScan(col) && !isBankerMobileHeader(col)) continue;
    const phone = coerceBankerPhoneDisplay(cellRaw(col));
    if (!phone) continue;
    const last10 = normalizeExcelPhoneValue(phone).slice(-10);
    if (usedPhones.has(last10)) continue;
    orphanPhones.push(phone);
    usedPhones.add(last10);
  }

  if ([1, 2, 3].some((s) => !phones[s])) {
    let oi = 0;
    for (let s = 1; s <= 3; s++) {
      if (!phones[s] && orphanPhones[oi]) {
        phones[s] = orphanPhones[oi];
        oi += 1;
      }
    }
  }

  if ([1, 2, 3].some((s) => !names[s])) {
    fillOrphanNames(cols, names);
  }
  if ([1, 2, 3].some((s) => !names[s])) {
    fillNamesBesidePhones(cols, names, phones);
  }

  return BANKER_ROW_LABELS.map(({ key, label, slot, type }) => ({
    key,
    label,
    value: type === "name" ? names[slot] || "" : phones[slot] || "",
  }));
}

export function contactsHaveRealData(contacts) {
  if (!Array.isArray(contacts)) return false;
  return contacts.some((c) => {
    if (c.key?.endsWith("Name")) return Boolean(coerceBankerNameDisplay(c.value));
    if (c.key?.endsWith("Phone")) return Boolean(coerceBankerPhoneDisplay(c.value));
    return false;
  });
}
