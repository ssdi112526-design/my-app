const {
  normalizeHeader,
  listExcelColumnsInFileOrder,
} = require("../modules/uploads/excelParser");
const {
  isBankerMobileValue,
  isLoanAccountValue,
  isPhoneLikeValue,
  isNameLikeValue,
  assignBankerSlot,
  sanitizeBankerPair,
  sanitizeBankerSlots,
  collectLoanDigitSet,
  isValueFromLoanColumns,
  isLoanColumnKey,
  reconcileLoanAndBankerPhones,
} = require("./bankerValueUtils");

function normHeader(value = "") {
  if (normalizeHeader) return normalizeHeader(value);
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function isCustomerMobile(value, caseDoc = {}) {
  const v = digitsOnly(value);
  if (!v || v.length < 10) return false;
  const cust = digitsOnly(caseDoc.mobileNumber);
  const alt = digitsOnly(caseDoc.alternateMobileNumber);
  if (cust && (v === cust || v.endsWith(cust.slice(-10)) || cust.endsWith(v.slice(-10)))) {
    return true;
  }
  if (alt && (v === alt || v.endsWith(alt.slice(-10)))) return true;
  return false;
}

function isCustomerFieldKey(nk) {
  const hasOrdinal = /\b(1st|2nd|3rd|first|second|third|1|2|3)\b/.test(nk);
  if ((nk === "contact number" || nk === "contact no") && !hasOrdinal && !nk.includes("banker")) {
    return true;
  }
  return (
    nk.includes("cust name") ||
    nk.includes("customer name") ||
    nk === "name" ||
    nk.includes("cust address") ||
    nk.includes("customer address") ||
    nk.includes("cust contact") ||
    nk.includes("customer mobile") ||
    (nk.includes("mobile") && nk.includes("customer")) ||
    nk.includes("vehicle no") ||
    nk.includes("registration") ||
    nk.includes("chasis") ||
    nk.includes("chassis") ||
    nk.includes("engine") ||
    nk === "make" ||
    nk === "model" ||
    nk.includes("emi") ||
    nk === "pos" ||
    nk.includes("remark") ||
    nk.includes("uploaded")
  );
}

function ordinalFromKey(nk) {
  if (/banker\s*1|bankar\s*1|1st\s*banker|first\s*banker|banker\s*no\s*1/.test(nk)) return 1;
  if (/banker\s*2|bankar\s*2|2nd\s*banker|second\s*banker|banker\s*no\s*2/.test(nk)) return 2;
  if (/banker\s*3|bankar\s*3|3rd\s*banker|third\s*banker|banker\s*no\s*3/.test(nk)) return 3;
  if (/\b(1st|first|level 1|contact 1|contact1|mailid 1|mail 1|email 1)\b/.test(nk)) return 1;
  if (/\b(2nd|second|level 2|contact 2|contact2|mailid 2|mail 2|email 2)\b/.test(nk)) return 2;
  if (/\b(3rd|third|level 3|contact 3|contact3|mailid 3|mail 3)\b/.test(nk)) return 3;
  const mobileOrd = nk.match(/^mobile no(?:\s+([123]))?$/);
  if (mobileOrd) {
    return mobileOrd[1] ? Number(mobileOrd[1]) : 0;
  }
  const m = nk.match(/\b([123])\b/);
  if (m) return Number(m[1]);
  return 0;
}

function isBankerRelatedKey(nk) {
  return (
    nk.includes("banker") ||
    nk.includes("bankar") ||
    nk.includes("confirmer") ||
    nk.includes("confirmation") ||
    nk.startsWith("level ") ||
    /^level\d/.test(nk) ||
    nk.includes("contact person") ||
    nk.includes("mailid") ||
    nk.includes("mail id") ||
    (nk.includes("contact") && nk.includes("number")) ||
    (nk.includes("contact") && /\b(1|2|3)\b/.test(nk)) ||
    nk.includes("executive") ||
    nk.includes("field manager") ||
    nk === "fm" ||
    nk.includes("recovery officer") ||
    nk.includes("collection officer") ||
    nk.includes("nodal") ||
    nk.includes("bank officer") ||
    nk.includes("telecaller") ||
    nk.includes("coordinator") ||
    nk.includes("signatory") ||
    nk.includes("authorized signatory")
  );
}

function isLooseBankerHeader(nk) {
  return (
    isLikelyBankerPhoneColumn(nk) ||
    isBankerRelatedKey(nk) ||
    /\bfm\b/.test(nk) ||
    nk.includes("ro name") ||
    nk.includes("recovery") ||
    nk.includes("repossession contact") ||
    nk.includes("bank contact") ||
    nk.includes("financer contact") ||
    (nk.includes("name") &&
      (nk.includes("officer") || nk.includes("manager") || nk.includes("executive")))
  );
}

function slotNeedsBankerFill(slots) {
  return [1, 2, 3].some(
    (i) => !String(slots[i]?.name || "").trim() && !String(slots[i]?.phone || "").trim()
  );
}

function slotNeedsPhoneFill(slots) {
  return [1, 2, 3].some((i) => !String(slots[i]?.phone || "").trim());
}

function slotNeedsNameFill(slots) {
  return [1, 2, 3].some((i) => !String(slots[i]?.name || "").trim());
}

/** Skip normalized mirror keys (snapshot stores original + norm duplicate). */
function isNormMirrorKey(key, excelFields) {
  const nk = normHeader(key);
  const raw = String(key).trim();
  if (!raw || raw.toLowerCase() !== nk) return false;
  return Object.keys(excelFields).some((k) => {
    if (k === key) return false;
    return normHeader(k) === nk && String(k).trim().toLowerCase() !== nk;
  });
}

/** All Excel columns in file order (keeps duplicate "mobile no" columns). */
function listExcelColumnsOrdered(excelFields) {
  return listExcelColumnsInFileOrder(excelFields).filter(
    (c) => c.value && c.value !== "-"
  );
}

function isLikelyBankerPhoneColumn(nk) {
  if (isCustomerFieldKey(nk)) return false;
  return (
    isPhoneKey(nk) ||
    /^mobile(\s+no)?(\s+[123])?$/.test(nk) ||
    /banker.*mobile|mobile.*banker|bankar.*mobile/.test(nk) ||
    nk.includes("mob") ||
    nk.includes("cell") ||
    nk.includes("tel") ||
    nk.includes("whatsapp") ||
    nk.includes("wp no")
  );
}

function isBankerNameHeader(nk) {
  const isBankerish = nk.includes("banker") || nk.includes("bankar") || nk.includes("confirmer");
  return (
    (isBankerish && nk.includes("name")) ||
    (/\b(1st|2nd|3rd|first|second|third)\b/.test(nk) && isBankerish)
  );
}

/** Fill empty banker phones from any column (header mismatch or unnamed columns). */
function fillMissingBankerPhonesFromExcel(excelFields, caseDoc, slots) {
  if (!slotNeedsPhoneFill(slots)) return slots;

  const loanDigitSet = collectLoanDigitSet(excelFields);
  const usedLast10 = new Set();
  [1, 2, 3].forEach((i) => {
    const d = digitsOnly(slots[i].phone);
    if (d.length >= 10) usedLast10.add(d.slice(-10));
  });

  const cols = listExcelColumnsOrdered(excelFields);
  const queue = [];

  for (const col of cols) {
    if (isExcludedAutoScanColumn(col.nk, col.value, caseDoc)) continue;
    if (isLoanColumnKey(col.nk)) continue;
    if (!isBankerMobileValue(col.value)) continue;
    if (isCustomerMobile(col.value, caseDoc)) continue;
    if (isValueFromLoanColumns(col.value, loanDigitSet) && !/^mobile|^mob\b/.test(col.nk)) {
      continue;
    }

    const last10 = digitsOnly(col.value).slice(-10);
    if (!last10 || last10.length < 10 || usedLast10.has(last10)) continue;

    const ord = ordinalFromKey(col.nk);
    if (ord && !String(slots[ord].phone || "").trim()) {
      assignBankerSlot(slots, ord, col.value, col.nk);
      usedLast10.add(last10);
      continue;
    }

    if (isLikelyBankerPhoneColumn(col.nk)) {
      queue.push(col);
    }
  }

  [1, 2, 3].forEach((slot) => {
    if (String(slots[slot].phone || "").trim()) return;
    while (queue.length) {
      const col = queue.shift();
      const last10 = digitsOnly(col.value).slice(-10);
      if (!last10 || usedLast10.has(last10)) continue;
      assignBankerSlot(slots, slot, col.value, col.nk);
      usedLast10.add(last10);
      break;
    }
  });

  sanitizeBankerSlots(slots);
  return slots;
}

/** Phone often sits in the column right after banker name (financer sheets). */
function fillPhonesAfterBankerNameColumns(excelFields, caseDoc, slots) {
  if (!slotNeedsPhoneFill(slots)) return slots;

  const loanDigitSet = collectLoanDigitSet(excelFields);
  const cols = listExcelColumnsOrdered(excelFields);

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!isBankerNameHeader(col.nk) && !col.nk.includes("bankar")) continue;

    let slot = ordinalFromKey(col.nk);
    const nameVal = String(col.value || "").trim();
    if (!slot && nameVal) {
      slot = [1, 2, 3].find((s) => String(slots[s].name || "").trim() === nameVal);
    }
    if (!slot) continue;
    if (String(slots[slot].phone || "").trim()) continue;

    for (let j = i + 1; j < Math.min(cols.length, i + 4); j++) {
      const next = cols[j];
      if (isBankerNameHeader(next.nk) && isNameLikeValue(next.value)) break;
      if (isLoanColumnKey(next.nk)) continue;
      if (!isBankerMobileValue(next.value) || isCustomerMobile(next.value, caseDoc)) continue;
      if (isValueFromLoanColumns(next.value, loanDigitSet) && !/^mobile|^mob\b/.test(next.nk)) {
        continue;
      }
      assignBankerSlot(slots, slot, next.value, next.nk);
      break;
    }
  }

  sanitizeBankerSlots(slots);
  return slots;
}

/** Skip vehicle/customer/branch columns when auto-scanning unknown layouts. */
function isExcludedAutoScanColumn(nk, value, caseDoc = {}) {
  if (isCustomerFieldKey(nk)) return true;
  if (nk.includes("loan") || nk.includes("agreement") || nk.includes("lan ")) return true;
  if (nk.includes("vehicle") || nk.includes("chassis") || nk.includes("chasis") || nk.includes("engine")) {
    return true;
  }
  if (nk === "make" || nk === "model" || nk.includes("model make")) return true;
  if (nk.includes("bucket") || nk === "pos" || nk.includes("outstanding")) return true;
  if (nk.includes("uploaded") || nk.includes("remark")) return true;
  if ((nk === "branch" || nk.startsWith("branch ") || nk.includes("branch name")) && !nk.includes("banker")) {
    return true;
  }
  if (nk === "finance" || nk.includes("financer name") || nk.includes("agency")) return true;
  if (nk.includes("address") && !nk.includes("banker")) return true;
  const custName = String(caseDoc.customerName || "")
    .trim()
    .toLowerCase();
  if (custName && String(value || "").trim().toLowerCase() === custName) return true;
  return false;
}

/**
 * When admin-mapped banker columns are missing, scan all Excel headers/values
 * and fill empty 1st/2nd/3rd banker slots (by header hint or column order).
 */
function autoScanBankerSlotsFromExcel(excelFields, caseDoc = {}, slots) {
  if (!excelFields || typeof excelFields !== "object") return slots;
  if (!slotNeedsPhoneFill(slots) && !slotNeedsNameFill(slots)) return slots;

  const cols = listExcelColumnsOrdered(excelFields);

  for (const c of cols) {
    if (isExcludedAutoScanColumn(c.nk, c.value, caseDoc)) continue;
    if (ordinalFromKey(c.nk)) continue;
    if (!isLooseBankerHeader(c.nk)) continue;

    const target = [1, 2, 3].find((i) => {
      if (isBankerMobileValue(c.value)) return !String(slots[i].phone || "").trim();
      if (isNameLikeValue(c.value)) return !String(slots[i].name || "").trim();
      return !String(slots[i].name || "").trim() && !String(slots[i].phone || "").trim();
    });
    if (target) assignBankerSlot(slots, target, c.value, c.nk);
  }

  if (slotNeedsPhoneFill(slots) || slotNeedsNameFill(slots)) {
    const phones = [];
    const names = [];
    const seenPhoneLast10 = new Set();

    for (const c of cols) {
      if (isExcludedAutoScanColumn(c.nk, c.value, caseDoc)) continue;
      if (String(c.value || "").includes("@")) continue;

      if (isBankerMobileValue(c.value) && !isCustomerMobile(c.value, caseDoc)) {
        const p10 = digitsOnly(c.value).slice(-10);
        if (p10.length >= 10 && !seenPhoneLast10.has(p10)) {
          seenPhoneLast10.add(p10);
          phones.push(c);
        }
        continue;
      }
      if (isNameLikeValue(c.value) && !isPhoneLikeValue(c.value)) {
        names.push(c);
      }
    }

    [1, 2, 3].forEach((slot, idx) => {
      if (!String(slots[slot].phone || "").trim() && phones[idx]) {
        assignBankerSlot(slots, slot, phones[idx].value, phones[idx].nk);
      }
      if (!String(slots[slot].name || "").trim() && names[idx]) {
        assignBankerSlot(slots, slot, names[idx].value, names[idx].nk);
      }
    });
  }

  sanitizeBankerSlots(slots);
  return slots;
}

function isPhoneKey(nk) {
  if (isCustomerFieldKey(nk)) return false;
  if (isLoanColumnKey(nk)) return false;
  if (/banker\s*[123]\s*(number|no|mobile|phone|contact)/.test(nk)) return true;
  if (/banker\s*no\s*[123]/.test(nk)) return true;
  return (
    nk.includes("contact number") ||
    nk.includes("contact no") ||
    (nk.includes("contact") && nk.includes("number")) ||
    /^mobile(\s+no)?(\s+[123])?$/.test(nk) ||
    nk.includes("mobile") ||
    nk.includes("phone") ||
    nk.includes("mob") ||
    nk.includes("cell") ||
    nk.includes("tel") ||
    nk.includes("whatsapp") ||
    (/\bno\b/.test(nk) && !nk.includes("loan") && !nk.includes("lan"))
  );
}

function isNameKey(nk) {
  return (
    nk.includes("banker") ||
    nk.includes("bankar") ||
    nk.includes("name") ||
    nk.includes("confirmer") ||
    nk.includes("confirmation") ||
    nk.startsWith("level") ||
    nk.includes("mailid") ||
    nk.includes("mail id") ||
    nk.includes("executive") ||
    nk === "finance"
  );
}

function isLoanKey(nk) {
  return (
    nk.includes("loan number") ||
    nk === "loan no" ||
    nk === "loan" ||
    nk.includes("lan no") ||
    nk === "lan"
  );
}

function isAgreementKey(nk) {
  return nk.includes("agreement");
}

/** Unique columns from excelFields (skip duplicate normalized keys). */
function listExcelColumns(excelFields) {
  if (!excelFields || typeof excelFields !== "object") return [];
  const byNorm = new Map();

  for (const [key, val] of Object.entries(excelFields)) {
    const value = String(val).trim();
    if (!value || value === "-") continue;
    const nk = normHeader(key);
    if (!nk) continue;
    const existing = byNorm.get(nk);
    if (!existing || key.length > existing.key.length) {
      byNorm.set(nk, { key, nk, value });
    }
  }

  return Array.from(byNorm.values());
}

/** Direct header match for financer-style columns (1st banker name, 1st contact number, …). */
function pickDirectFromExcelHeaders(excelFields) {
  const slots = {
    1: { name: "", phone: "" },
    2: { name: "", phone: "" },
    3: { name: "", phone: "" },
  };
  let loanNumber = "";

  for (const [key, val] of Object.entries(excelFields || {})) {
    const nk = normHeader(key);
    const v = String(val).trim();
    if (!v) continue;

    if (isLoanColumnKey(nk) || nk.includes("loan") || nk.includes("lan")) {
      if (isLoanAccountValue(v)) loanNumber = loanNumber || v;
      continue;
    }

    if (/^mobile(\s+no)?(\s+\d+)?$/.test(nk) || /^mob(ile)?\s*no(\s+\d+)?$/.test(nk)) {
      continue;
    }

    const bankerOrd = ordinalFromKey(nk);
    if (!bankerOrd) continue;

    const isBankerCol = /banker|bankar|confirmer|recovery officer|\bro\b|field manager|\bfm\b/.test(
      nk
    );
    const isPhoneCol =
      /contact|phone|mobile|\bno\b|number/.test(nk) && !/customer|cust|borrower/.test(nk);

    if (isBankerCol || isPhoneCol || (/contact/.test(nk) && /banker|bankar|number|name/.test(nk))) {
      assignBankerSlot(slots, bankerOrd, v, nk);
    }
  }

  let mobileSlot = 0;
  for (const col of listExcelColumnsInFileOrder(excelFields)) {
    if (!/^mobile(\s+no)?(\s+\d+)?$/.test(col.nk) && !/^mob(ile)?\s*no(\s+\d+)?$/.test(col.nk)) {
      continue;
    }
    if (!isBankerMobileValue(col.value)) continue;
    mobileSlot += 1;
    if (mobileSlot <= 3 && !String(slots[mobileSlot].phone || "").trim()) {
      assignBankerSlot(slots, mobileSlot, col.value, col.nk);
    }
  }

  sanitizeBankerSlots(slots);
  const s1 = sanitizeBankerPair(slots[1].name, slots[1].phone);
  const s2 = sanitizeBankerPair(slots[2].name, slots[2].phone);
  const s3 = sanitizeBankerPair(slots[3].name, slots[3].phone);

  return {
    contactPerson1Name: s1.name,
    contactPerson1Phone: s1.phone,
    contactPerson2Name: s2.name,
    contactPerson2Phone: s2.phone,
    contactPerson3Name: s3.name,
    contactPerson3Phone: s3.phone,
    loanNumber,
  };
}

/**
 * Detect banker / confirmation contacts from any Excel header layout.
 */
function inferBankerContactsFromExcel(excelFields, caseDoc = {}) {
  const loanDigitSet = collectLoanDigitSet(excelFields);
  const direct = pickDirectFromExcelHeaders(excelFields);
  const slots = {
    1: { name: direct.contactPerson1Name, phone: direct.contactPerson1Phone, email: "" },
    2: { name: direct.contactPerson2Name, phone: direct.contactPerson2Phone, email: "" },
    3: { name: direct.contactPerson3Name, phone: direct.contactPerson3Phone, email: "" },
  };
  let loanVL = /^vl/i.test(direct.loanNumber) ? direct.loanNumber : "";
  let loanOther = !loanVL && direct.loanNumber ? direct.loanNumber : "";

  const cols = listExcelColumns(excelFields);

  for (const col of cols) {
    const { nk, value } = col;
    if (isCustomerFieldKey(nk)) continue;

    const ord = ordinalFromKey(nk);
    const d = digitsOnly(value);
    const isEmail = value.includes("@");
    const isPhone =
      !isEmail &&
      isBankerMobileValue(value) &&
      !isCustomerMobile(value, caseDoc) &&
      isPhoneKey(nk);

    if ((isLoanKey(nk) || isLoanColumnKey(nk)) && !isAgreementKey(nk)) {
      if (isLoanAccountValue(value)) {
        if (/^vl/i.test(value)) loanVL = value;
        else if (!loanOther) loanOther = value;
      }
      continue;
    }

    if (isAgreementKey(nk)) {
      if (!loanOther && isLoanAccountValue(value)) loanOther = value;
      continue;
    }

    if (isLoanAccountValue(value) && /^vl/i.test(value) && !loanVL) {
      loanVL = value;
      continue;
    }

    if (!ord) {
      if (!isBankerRelatedKey(nk)) continue;
      if (isPhoneKey(nk) || (nk.includes("contact") && nk.includes("number"))) continue;
    }

    const slot = ord;
    if (!slot) continue;

    if (isEmail || (isNameKey(nk) && isEmail)) {
      if (!slots[slot].email) slots[slot].email = value;
      if (!slots[slot].name) slots[slot].name = value;
      continue;
    }

    if (isPhoneKey(nk) || (nk.includes("contact") && nk.includes("number"))) {
      if (!slots[slot].phone) slots[slot].phone = value;
      continue;
    }

    if (isPhone || (isBankerRelatedKey(nk) && isPhoneKey(nk))) {
      if (!slots[slot].phone) slots[slot].phone = value;
      continue;
    }

    if (isNameKey(nk) || nk.startsWith("level")) {
      assignBankerSlot(slots, slot, value, nk);
      continue;
    }

    if (isBankerRelatedKey(nk)) {
      assignBankerSlot(slots, slot, value, nk);
    }
  }

  sanitizeBankerSlots(slots);

  // Positional fallback: banker-like columns in file order (skip id/customer/vehicle block)
  const positional = cols.filter((c) => {
    if (isCustomerFieldKey(c.nk)) return false;
    if (c.nk.includes("loan") || c.nk.includes("agreement") || c.nk.includes("make")) {
      return false;
    }
    if (isCustomerMobile(c.value, caseDoc)) return false;
    const custName = String(caseDoc.customerName || "").trim().toLowerCase();
    if (custName && c.value.toLowerCase() === custName) return false;
    return true;
  });

  const phoneCols = positional.filter((c) => {
    const hasOrdinal = /\b(1st|2nd|3rd|first|second|third)\b/.test(c.nk);
    if ((c.nk === "contact number" || c.nk === "contact no") && !hasOrdinal) {
      return false;
    }
    if (isLoanColumnKey(c.nk)) return false;
    if (isValueFromLoanColumns(c.value, loanDigitSet) && !/^mobile|^mob\b/.test(c.nk)) {
      return false;
    }
    const d = digitsOnly(c.value);
    return isBankerMobileValue(c.value) && !isCustomerMobile(c.value, caseDoc);
  });
  const nameCols = positional.filter((c) => {
    if (c.value.includes("@")) return true;
    const d = digitsOnly(c.value);
    if (d.length >= 10) return false;
    if (/^[A-Z]{2,}\d+/i.test(c.value) && c.value.length < 20) return false;
    return c.value.length > 1;
  });

  for (const c of phoneCols) {
    const ord = ordinalFromKey(c.nk);
    if (ord) assignBankerSlot(slots, ord, c.value, c.nk);
  }
  for (const c of nameCols) {
    const ord = ordinalFromKey(c.nk);
    if (ord) assignBankerSlot(slots, ord, c.value, c.nk);
  }

  autoScanBankerSlotsFromExcel(excelFields, caseDoc, slots);
  fillPhonesAfterBankerNameColumns(excelFields, caseDoc, slots);
  fillMissingBankerPhonesFromExcel(excelFields, caseDoc, slots);
  sanitizeBankerSlots(slots);
  const s1 = sanitizeBankerPair(slots[1].name || slots[1].email, slots[1].phone);
  const s2 = sanitizeBankerPair(slots[2].name || slots[2].email, slots[2].phone);
  const s3 = sanitizeBankerPair(slots[3].name, slots[3].phone);

  const slotsOut = {
    1: { phone: s1.phone },
    2: { phone: s2.phone },
    3: { phone: s3.phone },
  };
  const loanNumber = reconcileLoanAndBankerPhones(slotsOut, loanVL, loanOther);

  return {
    contactPerson1Name: s1.name,
    contactPerson1Phone: slotsOut[1].phone || "",
    contactPerson2Name: s2.name,
    contactPerson2Phone: slotsOut[2].phone || "",
    contactPerson3Name: s3.name,
    contactPerson3Phone: slotsOut[3].phone || "",
    bankNotifyEmail1: slots[1].email,
    bankNotifyEmail2: slots[2].email,
    loanNumber,
  };
}

module.exports = {
  inferBankerContactsFromExcel,
  autoScanBankerSlotsFromExcel,
  listExcelColumns,
  normHeader,
};
