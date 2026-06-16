function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function last10Digits(value) {
  const d = digitsOnly(value);
  return d.length >= 10 ? d.slice(-10) : d;
}

/** Loan / LAN / agreement columns — never treat as banker mobile. */
function isLoanColumnKey(nk = "") {
  const n = String(nk).toLowerCase().trim();
  if (!n) return false;
  if (n.includes("loan number") || n.includes("loan no") || n.includes("loan account")) return true;
  if (n === "loan" || n === "lan" || n.includes("lan no")) return true;
  if (n.includes("agreement") && (n.includes("no") || n.includes("number"))) return true;
  if (n.includes("loan") && !n.includes("upload")) return true;
  return false;
}

/** Build set of last-10 digits from values in loan/agreement Excel columns. */
function collectLoanDigitSet(excelFields) {
  const set = new Set();
  if (!excelFields || typeof excelFields !== "object") return set;
  for (const [key, val] of Object.entries(excelFields)) {
    const nk = String(key)
      .trim()
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ");
    if (!isLoanColumnKey(nk)) continue;
    const last10 = last10Digits(val);
    if (last10.length >= 10) set.add(last10);
  }
  return set;
}

function isValueFromLoanColumns(value, loanDigitSet) {
  const last10 = last10Digits(value);
  return last10.length >= 10 && loanDigitSet.has(last10);
}

function normalizeExcelPhoneValue(value) {
  let raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/e[+-]?\d+/i.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) raw = String(Math.round(n));
  } else if (/^\d+\.\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1e9) raw = String(Math.round(n));
    else raw = raw.replace(/\.0+$/, "");
  }
  let d = digitsOnly(raw);
  if (d.length > 10) d = d.slice(-10);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d;
}

/** Indian banker mobile — exactly 10 digits (6–9 start), optional +91 / leading 0. */
function isBankerMobileValue(value) {
  const d = normalizeExcelPhoneValue(value);
  if (!d) return false;
  if (d.length === 10) return /^[6-9]\d{9}$/.test(d);
  return false;
}

/** Loan / LAN / VL account (not a plain 10-digit mobile). */
function isLoanAccountValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const compact = raw.replace(/\s/g, "");
  if (/^(vl|lan|laan)/i.test(compact)) return true;
  if (/[a-zA-Z]/.test(raw) && /\d/.test(raw)) return true;
  if (isBankerMobileValue(raw)) return false;
  const d = digitsOnly(raw);
  if (d.length === 10) return false;
  return d.length > 10;
}

/** True when value is primarily a phone (generic; use isBankerMobileValue for banker slots). */
function isPhoneLikeValue(value) {
  return isBankerMobileValue(value);
}

/** True when value looks like a person/place name (letters), not a phone number. */
function isNameLikeValue(value) {
  const raw = String(value || "").trim();
  if (!raw || isPhoneLikeValue(raw)) return false;
  if (raw.includes("@")) return true;
  return /[a-zA-Z\u0900-\u097F]/.test(raw);
}

const BANKER_FLAG_ONLY = /^(y|n|yes|no|na|n\/a|null|-|tbr)$/i;

function coerceBankerNameDisplay(value) {
  const raw = String(value ?? "").trim();
  if (!raw || BANKER_FLAG_ONLY.test(raw)) return "";
  if (/^(yes|no)$/i.test(raw)) return "";
  if (/^TBR\s*(yes|no)?$/i.test(raw)) return "";
  return raw;
}

function coerceBankerPhoneDisplay(value) {
  const raw = String(value ?? "").trim();
  if (!raw || BANKER_FLAG_ONLY.test(raw)) return "";
  if (/^(yes|no)$/i.test(raw)) return "";
  const normalized = normalizeExcelPhoneValue(raw);
  if (isBankerMobileValue(normalized)) return normalized;
  const d = digitsOnly(raw);
  if (d.length >= 10) return d.slice(-10);
  if (d.length >= 6) return d;
  return "";
}

function isValidBankerName(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (BANKER_FLAG_ONLY.test(raw)) return false;
  if (/^TBR\b/i.test(raw)) return false;
  if (/^(YES|NO)$/i.test(upper)) return false;
  if (/^(Y|N)$/i.test(raw)) return false;
  if (/allocation|seasoning|tbrflag|tbr\s*flag/i.test(raw)) return false;
  if (!isNameLikeValue(raw) || isLoanAccountValue(raw)) return false;
  const stripped = raw.replace(/^tbr\s*/i, "").trim();
  if (!stripped || BANKER_FLAG_ONLY.test(stripped)) return false;
  if (/^(yes|no|y|n)$/i.test(stripped)) return false;
  return stripped.length >= 2;
}

function isValidBankerPhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (BANKER_FLAG_ONLY.test(raw)) return false;
  if (/^(yes|no)$/i.test(raw)) return false;
  return isBankerMobileValue(raw);
}

function sanitizeBankerFieldValue(key, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (String(key).endsWith("Phone")) return coerceBankerPhoneDisplay(raw);
  if (String(key).endsWith("Name")) return coerceBankerNameDisplay(raw);
  return raw;
}

function sanitizeBankerPair(name, phone) {
  let n = String(name || "").trim();
  let p = String(phone || "").trim();
  if (n && isBankerMobileValue(n)) {
    if (!p) p = n;
    n = "";
  }
  if (p && isNameLikeValue(p) && !isPhoneLikeValue(p)) {
    if (!n) n = p;
    p = "";
  }
  return { name: n, phone: p };
}

function sanitizeBankerSlots(slots) {
  [1, 2, 3].forEach((i) => {
    if (!slots[i]) return;
    const fixed = sanitizeBankerPair(slots[i].name, slots[i].phone);
    slots[i].name = fixed.name;
    slots[i].phone = fixed.phone;
  });
  return slots;
}

/**
 * Put value in name or phone slot based on content (digits → phone, text → name).
 */
function assignBankerSlot(slots, ord, value, nk = "") {
  const v = String(value || "").trim();
  if (!v || !ord || !slots[ord]) return;

  const nkNorm = String(nk || "").toLowerCase();
  const headerIsPhone =
    /^mobile(\s+no)?(\s+[123])?$/.test(nkNorm) ||
    /banker.*mobile|mobile.*banker|bankar.*mobile/.test(nkNorm) ||
    nkNorm.includes("mob no") ||
    nkNorm.includes("cell") ||
    nkNorm.includes("whatsapp") ||
    nkNorm.includes("telephone") ||
    (/contact|phone|mobile|\bno\b/.test(nkNorm) && /number|mobile|phone|no|tel/.test(nkNorm)) ||
    (nkNorm.includes("contact") && !nkNorm.includes("name"));
  const headerIsName =
    (nkNorm.includes("banker") ||
      nkNorm.includes("bankar") ||
      nkNorm.includes("name") ||
      nkNorm.includes("confirmer")) &&
    !headerIsPhone;

  if (headerIsPhone || isBankerMobileValue(v)) {
    if (isBankerMobileValue(v) && !slots[ord].phone) slots[ord].phone = v;
    return;
  }
  if (isNameLikeValue(v) || headerIsName) {
    if (!slots[ord].name) slots[ord].name = v;
  }
}

/** Keep loan (LAN/VL/…) and 10-digit banker phones separate. */
function reconcileLoanAndBankerPhones(slots, loanVL = "", loanOther = "") {
  let loan = String(loanVL || loanOther || "").trim();
  if (loan && !isLoanAccountValue(loan)) {
    loan = String(loanVL || "").trim();
  }

  const loanLast10 = last10Digits(loan);
  const phoneLast10 = [1, 2, 3]
    .map((i) => last10Digits(slots[i]?.phone))
    .filter((d) => d.length >= 10);

  if (loanLast10.length >= 10 && phoneLast10.includes(loanLast10)) {
    loan = String(loanVL || "").trim();
  }

  [1, 2, 3].forEach((i) => {
    if (!slots[i]) return;
    if (slots[i].phone && !isBankerMobileValue(slots[i].phone)) {
      slots[i].phone = "";
    }
  });

  return loan;
}

module.exports = {
  digitsOnly,
  last10Digits,
  normalizeExcelPhoneValue,
  isLoanColumnKey,
  collectLoanDigitSet,
  isValueFromLoanColumns,
  isBankerMobileValue,
  isLoanAccountValue,
  isPhoneLikeValue,
  isNameLikeValue,
  isValidBankerName,
  isValidBankerPhone,
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  sanitizeBankerFieldValue,
  sanitizeBankerPair,
  sanitizeBankerSlots,
  assignBankerSlot,
  reconcileLoanAndBankerPhones,
};
