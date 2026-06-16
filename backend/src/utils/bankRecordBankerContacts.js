const { listExcelColumnsInFileOrder } = require("../modules/uploads/excelParser");
const { readBankerFromExcelHeaders } = require("./readBankerFromExcelHeaders");
const {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  normalizeExcelPhoneValue,
} = require("./bankerValueUtils");

const BANKER_CONTACT_LABELS = [
  { key: "banker1Name", label: "1st bankar Name", slot: 1, type: "name" },
  { key: "banker1Phone", label: "mobile no 1", slot: 1, type: "phone" },
  { key: "banker2Name", label: "2nd bankar Name", slot: 2, type: "name" },
  { key: "banker2Phone", label: "mobile no 2", slot: 2, type: "phone" },
  { key: "banker3Name", label: "3rd bankar Name", slot: 3, type: "name" },
  { key: "banker3Phone", label: "mobile no 3", slot: 3, type: "phone" },
];

function hay(col) {
  return `${col.label || ""} ${col.key || ""}`.toLowerCase();
}

function cellRaw(extra, col) {
  if (!col || !extra) return "";
  const key = col.key || col.label;
  const label = col.label || col.key;
  let raw = extra[key];
  if ((raw == null || raw === "") && label !== key) raw = extra[label];
  return String(raw ?? "").trim();
}

function isYnFlag(value) {
  return /^(y|n|yes|no)$/i.test(String(value ?? "").trim());
}

function isTbrFlagValue(value) {
  const t = String(value ?? "").trim();
  if (!t) return false;
  if (isYnFlag(t)) return true;
  return /^tbr(\s+(yes|no))?$/i.test(t);
}

function isTbrColumnHeader(col) {
  const h = hay(col);
  return /\btbr\b/.test(h) && !/bankar|banker/.test(h);
}

function isBankerNameHeader(col) {
  const h = hay(col);
  if (isTbrColumnHeader(col)) return false;
  if (!/bankar|banker/.test(h)) return false;
  if (/mobile|phone/.test(h) && !/\bname\b/.test(h)) return false;
  return /\b(1st|2nd|3rd|first|second|third)\b/.test(h) || /\bname\b/.test(h);
}

function isBankerMobileHeader(col) {
  const h = hay(col);
  if (isTbrColumnHeader(col)) return false;
  if (/customer|borrower|debtor/.test(h)) return false;
  return /mobile\s*no|bankar.*mobile|banker.*mobile|confirmer.*mobile|contact.*mobile/.test(
    h
  );
}

function isAlternateBankerNameHeader(col) {
  const h = hay(col);
  if (isTbrColumnHeader(col)) return false;
  if (/customer|borrower|debtor/.test(h)) return false;
  return (
    /confirmer|contact\s*person|bank\s*officer|recovery\s*officer|collection\s*officer/.test(
      h
    ) && /name/.test(h)
  );
}

function scanNearbyName(extra, cols, startIdx) {
  for (let j = startIdx; j >= Math.max(0, startIdx - 4); j--) {
    if (j !== startIdx && (isBankerNameHeader(cols[j]) || isAlternateBankerNameHeader(cols[j]))) {
      break;
    }
    const name = coerceBankerNameDisplay(cellRaw(extra, cols[j]));
    if (name) return name;
  }
  for (let j = startIdx + 1; j < Math.min(cols.length, startIdx + 8); j++) {
    const col = cols[j];
    if (isBankerNameHeader(col) || isAlternateBankerNameHeader(col)) break;
    if (isTbrColumnHeader(col)) continue;
    const raw = cellRaw(extra, col);
    if (isYnFlag(raw) || isTbrFlagValue(raw)) continue;
    const name = coerceBankerNameDisplay(raw);
    if (name) return name;
  }
  return "";
}

function scanNearbyPhone(extra, cols, startIdx) {
  for (let j = startIdx + 1; j < Math.min(cols.length, startIdx + 8); j++) {
    const col = cols[j];
    if (isBankerNameHeader(col) || isAlternateBankerNameHeader(col)) break;
    if (isTbrColumnHeader(col)) continue;
    const raw = cellRaw(extra, col);
    if (isYnFlag(raw) || isTbrFlagValue(raw)) continue;
    const phone = coerceBankerPhoneDisplay(raw);
    if (phone) return phone;
  }
  return "";
}

function isSkipColumnForPhoneScan(col) {
  const h = hay(col);
  return (
    /customer|borrower|debtor|loan|chassis|engine|vehicle|reg|tbr|allocation|seasoning/.test(
      h
    ) || isTbrColumnHeader(col)
  );
}

function nameSlotFromHeader(col) {
  const h = hay(col);
  if (/\b(1st|first)\b/.test(h)) return 1;
  if (/\b(2nd|second)\b/.test(h)) return 2;
  if (/\b(3rd|third)\b/.test(h)) return 3;
  return 0;
}

function mobileSlotFromHeader(col) {
  const sk = String(col.key || "").toLowerCase();
  const h = hay(col);
  if (/mobile\s*no[\s_]*3\b/.test(sk) || /mobile\s*no[\s_]*3\b/.test(h)) return 3;
  if (/mobile\s*no[\s_]*2\b/.test(sk) || /mobile\s*no[\s_]*2\b/.test(h)) return 2;
  if (/mobile\s*no[\s_]*1\b/.test(sk) || /mobile\s*no[\s_]*1\b/.test(h)) return 1;
  if (/mobile\s*no_3|mobile\s*no\s*3/.test(sk)) return 3;
  if (/mobile\s*no_2|mobile\s*no\s*2/.test(sk)) return 2;
  if (/^mobile\s*no$/.test(sk)) return 1;
  const m = sk.match(/mobile\s*no_(\d+)/);
  if (m) return Math.min(Number(m[1]), 3);
  return 0;
}

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

function extractPairedBankerFromCols(extra, cols) {
  const names = { 1: "", 2: "", 3: "" };
  const phones = { 1: "", 2: "", 3: "" };

  for (const { slot, nameMatch, phoneMatch } of PAIRED_BANKER_SLOTS) {
    for (const col of cols) {
      const h = hay(col);
      if (nameMatch(h)) {
        const name = coerceBankerNameDisplay(cellRaw(extra, col));
        if (name) names[slot] = name;
      }
      if (phoneMatch(h)) {
        const phone = coerceBankerPhoneDisplay(cellRaw(extra, col));
        if (phone) phones[slot] = phone;
      }
    }
  }

  return { names, phones };
}

function buildBankerContactsFromExtra(extraFields = {}) {
  const extra = extraFields && typeof extraFields === "object" ? extraFields : {};
  const cols = listExcelColumnsInFileOrder(extra);

  const direct = readBankerFromExcelHeaders(extra);
  const paired = extractPairedBankerFromCols(extra, cols);
  const names = { ...paired.names };
  const phones = { ...paired.phones };

  for (let s = 1; s <= 3; s++) {
    if (!names[s] && direct[`banker${s}Name`]) names[s] = direct[`banker${s}Name`];
    if (!phones[s] && direct[`banker${s}Phone`]) phones[s] = direct[`banker${s}Phone`];
  }

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
      let name = coerceBankerNameDisplay(cellRaw(extra, col));
      if (!name) name = scanNearbyName(extra, cols, i);
      if (name) names[slot] = name;
    }

    if (!phones[slot]) {
      const phone = scanNearbyPhone(extra, cols, i);
      if (phone) phones[slot] = phone;
    }
  }

  let mobileSeq = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!isBankerMobileHeader(col)) continue;
    const raw = cellRaw(extra, col);
    let phone = coerceBankerPhoneDisplay(raw);
    if (!phone && (isYnFlag(raw) || isTbrFlagValue(raw))) {
      phone = scanNearbyPhone(extra, cols, i);
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
    const phone = coerceBankerPhoneDisplay(cellRaw(extra, col));
    if (!phone) continue;
    const last10 = normalizeExcelPhoneValue(phone).slice(-10);
    if (usedPhones.has(last10)) continue;
    orphanPhones.push(phone);
    usedPhones.add(last10);
  }

  let oi = 0;
  for (let s = 1; s <= 3; s++) {
    if (!phones[s] && orphanPhones[oi]) {
      phones[s] = orphanPhones[oi];
      oi += 1;
    }
  }

  return BANKER_CONTACT_LABELS.map(({ key, label, slot, type }) => ({
    key,
    label,
    value: type === "name" ? names[slot] || "" : phones[slot] || "",
  }));
}

function bankerContactsToSnapshot(contacts) {
  const byKey = Object.fromEntries(contacts.map((c) => [c.key, c.value]));
  return {
    banker1Name: byKey.banker1Name || "",
    banker1Phone: byKey.banker1Phone || "",
    banker2Name: byKey.banker2Name || "",
    banker2Phone: byKey.banker2Phone || "",
    banker3Name: byKey.banker3Name || "",
    banker3Phone: byKey.banker3Phone || "",
    loanNumber: "",
  };
}

module.exports = {
  buildBankerContactsFromExtra,
  bankerContactsToSnapshot,
  BANKER_CONTACT_LABELS,
};
