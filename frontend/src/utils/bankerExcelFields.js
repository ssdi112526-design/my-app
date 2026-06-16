import {
  assignBankerSlot,
  collectLoanDigitSet,
  isBankerMobileValue,
  isLoanAccountValue,
  isLoanColumnKey,
  isNameLikeValue,
  isPhoneLikeValue,
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
  isValueFromLoanColumns,
  reconcileLoanAndBankerPhones,
  sanitizeBankerPair,
  sanitizeBankerSlots,
} from "./bankerValueUtils";
import { listExcelColumnsInFileOrder } from "./excelSheetDisplay";
import { resolveBankerPhonesFromExcel } from "./bankerMobileFromExcel";

/** Standard admin labels — always shown (blank if missing). */
export const ADMIN_BANKER_FIELD_DEFS = [
  { key: "banker1Name", label: "1st bankar Name" },
  { key: "banker1Phone", label: "mobile no" },
  { key: "banker2Name", label: "2nd bankar Name" },
  { key: "banker2Phone", label: "mobile no" },
  { key: "banker3Name", label: "3rd bankar Name" },
  { key: "banker3Phone", label: "mobile no" },
  { key: "loanNumber", label: "Loan Number" },
];

export function normalizeExcelHeader(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
}

export function pickExcelField(excelFields, aliases = []) {
  if (!excelFields || typeof excelFields !== "object") return "";
  const normAliases = aliases.map((a) => normalizeExcelHeader(a));

  for (const [key, val] of Object.entries(excelFields)) {
    if (String(key).startsWith("_")) continue;
    const nk = normalizeExcelHeader(key);
    if (normAliases.includes(nk)) {
      const text = String(val).trim();
      if (text) return text;
    }
  }

  for (const alias of normAliases) {
    for (const [key, val] of Object.entries(excelFields)) {
      if (String(key).startsWith("_")) continue;
      const nk = normalizeExcelHeader(key);
      if (!nk || !alias) continue;
      if (
        nk === alias ||
        nk.includes(alias) ||
        (alias.includes(nk) && nk.length >= alias.length)
      ) {
        const text = String(val).trim();
        if (text) return text;
      }
    }
  }

  return "";
}

export function firstNonEmpty(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "-") return s;
  }
  return "";
}

const BANKER_ALIASES = {
  banker1Name: [
    "1st bankar name",
    "1st banker name",
    "first bankar name",
    "first banker name",
    "1st banker",
    "contact person 1 name",
    "contact person 1",
    "1st confirmer",
    "first confirmer",
  ],
  banker1Phone: [
    "mobile no",
    "banker 1 number",
    "banker1 number",
    "banker 1 no",
    "banker 1 mobile",
    "banker 1 phone",
    "1st banker number",
    "first banker number",
    "1st mobile no",
    "mobile no 1",
    "mobile no_1",
    "1st contact number",
    "first contact number",
    "1st contact no",
    "contact person 1 number",
    "contact person 1 phone",
    "1st confirmer no",
    "1st confirmer number",
    "contact 1 number",
  ],
  banker2Name: [
    "2nd bankar name",
    "2nd banker name",
    "second bankar name",
    "second banker name",
    "2nd banker",
    "contact person 2 name",
    "2nd confirmer",
  ],
  banker2Phone: [
    "banker 2 number",
    "banker2 number",
    "banker 2 no",
    "banker 2 mobile",
    "2nd banker number",
    "second banker number",
    "2nd mobile no",
    "mobile no 2",
    "mobile no_2",
    "2nd contact number",
    "second contact number",
    "2nd contact no",
    "contact person 2 number",
    "contact person 2 phone",
    "2nd confirmer no",
    "2nd confirmer number",
    "contact 2 number",
  ],
  banker3Name: [
    "3rd bankar name",
    "3rd banker name",
    "third bankar name",
    "third banker name",
    "3rd banker",
    "third banker",
    "contact person 3 name",
    "3rd confirmer",
  ],
  banker3Phone: [
    "banker 3 number",
    "banker3 number",
    "banker 3 no",
    "banker 3 mobile",
    "3rd banker number",
    "third banker number",
    "3rd mobile no",
    "mobile no 3",
    "mobile no_3",
    "3rd contact number",
    "third contact number",
    "3rd contact no",
    "contact person 3 number",
    "contact person 3 phone",
    "3rd confirmer no",
    "third confirmer no",
    "contact 3 number",
  ],
  loanNumber: [
    "loan number",
    "loan account number",
    "loan no",
    "lan",
    "lan no",
    "agreement number",
    "agreement no",
  ],
};

const DOC_KEY_BY_BANKER_KEY = {
  banker1Name: "contactPerson1Name",
  banker1Phone: "contactPerson1Phone",
  banker2Name: "contactPerson2Name",
  banker2Phone: "contactPerson2Phone",
  banker3Name: "contactPerson3Name",
  banker3Phone: "contactPerson3Phone",
  loanNumber: "loanAccountNumber",
};

const INFER_MAP = {
  banker1Name: "contactPerson1Name",
  banker1Phone: "contactPerson1Phone",
  banker2Name: "contactPerson2Name",
  banker2Phone: "contactPerson2Phone",
  banker3Name: "contactPerson3Name",
  banker3Phone: "contactPerson3Phone",
  loanNumber: "loanNumber",
};

/** Resolved banker + loan fields — aliases + auto-detect any Excel column names. */
export function getBankerFieldsFromCase(caseDoc) {
  const doc = caseDoc && typeof caseDoc === "object" ? caseDoc : {};
  const rawExcel = doc.excelFields;
  const e =
    rawExcel && typeof rawExcel === "object" && !Array.isArray(rawExcel) ? rawExcel : {};
  const out = {};

  const inferred =
    Object.keys(e).length > 0 ? inferBankerContactsFromExcelClient(e, doc) || {} : {};

  for (const { key } of ADMIN_BANKER_FIELD_DEFS) {
    const docKey = DOC_KEY_BY_BANKER_KEY[key];
    const infKey = INFER_MAP[key];
    let val = firstNonEmpty(doc[docKey], inferred[infKey], pickExcelField(e, BANKER_ALIASES[key]));
    if (key.endsWith("Phone")) {
      val = coerceBankerPhoneDisplay(val);
    }
    if (key.endsWith("Name")) {
      val = coerceBankerNameDisplay(val);
    }
    if (key === "loanNumber") {
      val = isLoanAccountValue(val) ? val : "";
    }
    out[key] = val;
  }

  const loanStored = String(doc.loanAccountNumber || "").trim();
  out.loanNumber = firstNonEmpty(
    isLoanAccountValue(out.loanNumber) ? out.loanNumber : "",
    isLoanAccountValue(loanStored) ? loanStored : "",
    isLoanAccountValue(inferred.loanNumber) ? inferred.loanNumber : "",
    pickExcelField(e, ["loan number", "loan no", "lan", "lan no", "agreement number", "agreement no"])
  );
  out.loanNumber = isLoanAccountValue(out.loanNumber) ? out.loanNumber : "";

  const b1 = sanitizeBankerPair(out.banker1Name, out.banker1Phone);
  const b2 = sanitizeBankerPair(out.banker2Name, out.banker2Phone);
  const b3 = sanitizeBankerPair(out.banker3Name, out.banker3Phone);
  out.banker1Name = b1.name;
  out.banker1Phone = b1.phone;
  out.banker2Name = b2.name;
  out.banker2Phone = b2.phone;
  out.banker3Name = b3.name;
  out.banker3Phone = b3.phone;

  const phones = resolveBankerPhonesFromExcel(e, doc, out);
  out.banker1Phone = phones[0] || out.banker1Phone;
  out.banker2Phone = phones[1] || out.banker2Phone;
  out.banker3Phone = phones[2] || out.banker3Phone;

  return out;
}

function ordinalFromKeyClient(nk) {
  if (/banker\s*1|bankar\s*1|1st\s*banker|first\s*banker|banker\s*no\s*1/.test(nk)) return 1;
  if (/banker\s*2|bankar\s*2|2nd\s*banker|second\s*banker|banker\s*no\s*2/.test(nk)) return 2;
  if (/banker\s*3|bankar\s*3|3rd\s*banker|third\s*banker|banker\s*no\s*3/.test(nk)) return 3;
  if (/\b(1st|first|level 1|contact 1|contact1|mailid 1|mail 1)\b/.test(nk)) return 1;
  if (/\b(2nd|second|level 2|contact 2|contact2|mailid 2|mail 2)\b/.test(nk)) return 2;
  if (/\b(3rd|third|level 3|contact 3|contact3|mailid 3|mail 3)\b/.test(nk)) return 3;
  const mobileOrd = nk.match(/^mobile no(?:\s+([123]))?$/);
  if (mobileOrd) return mobileOrd[1] ? Number(mobileOrd[1]) : 0;
  const m = nk.match(/\b([123])\b/);
  if (m) return Number(m[1]);
  return 0;
}

function isNormMirrorKeyClient(key, excelFields) {
  const nk = normalizeExcelHeader(key);
  const raw = String(key).trim();
  if (!raw || raw.toLowerCase() !== nk) return false;
  return Object.keys(excelFields).some((k) => {
    if (k === key) return false;
    return normalizeExcelHeader(k) === nk && String(k).trim().toLowerCase() !== nk;
  });
}

function listExcelColumnsOrderedClient(excelFields) {
  return listExcelColumnsInFileOrder(excelFields).filter(
    (c) => c.value && c.value !== "-"
  );
}

function slotNeedsPhoneFillClient(slots) {
  return [1, 2, 3].some((i) => !String(slots[i]?.phone || "").trim());
}

function isPhoneKeyClient(nk) {
  if (
    nk.includes("cust name") ||
    nk.includes("customer name") ||
    (nk.includes("mobile") && nk.includes("customer")) ||
    nk.includes("cust contact")
  ) {
    return false;
  }
  if (isLoanColumnKey(nk)) return false;
  if (/banker\s*[123]\s*(number|no|mobile|phone|contact)/.test(nk)) return true;
  if (/banker\s*no\s*[123]/.test(nk)) return true;
  return (
    nk.includes("contact number") ||
    nk.includes("contact no") ||
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

function isLikelyBankerPhoneColumnClient(nk) {
  return isPhoneKeyClient(nk);
}

function isBankerNameHeaderClient(nk) {
  const isBankerish = nk.includes("banker") || nk.includes("bankar") || nk.includes("confirmer");
  return (
    (isBankerish && nk.includes("name")) ||
    (/\b(1st|2nd|3rd|first|second|third)\b/.test(nk) && isBankerish)
  );
}

function fillMissingBankerPhonesFromExcelClient(excelFields, caseDoc, slots) {
  if (!slotNeedsPhoneFillClient(slots)) return slots;

  const loanDigitSet = collectLoanDigitSet(excelFields);
  const digitsOnlyLocal = (v) => String(v || "").replace(/\D/g, "");
  const isCustPhone = (value) => {
    const v = digitsOnlyLocal(value);
    if (v.length < 10) return false;
    const c = digitsOnlyLocal(caseDoc.mobileNumber);
    const a = digitsOnlyLocal(caseDoc.alternateMobileNumber);
    return (c && v.slice(-10) === c.slice(-10)) || (a && v.slice(-10) === a.slice(-10));
  };

  const usedLast10 = new Set();
  [1, 2, 3].forEach((i) => {
    const d = digitsOnlyLocal(slots[i].phone);
    if (d.length >= 10) usedLast10.add(d.slice(-10));
  });

  const cols = listExcelColumnsOrderedClient(excelFields);
  const queue = [];

  for (const col of cols) {
    if (isExcludedAutoScanColumnClient(col.nk, col.value, caseDoc)) continue;
    if (isLoanColumnKey(col.nk)) continue;
    if (!isPhoneLikeValue(col.value)) continue;
    if (isCustPhone(col.value)) continue;
    if (isValueFromLoanColumns(col.value, loanDigitSet) && !/^mobile|^mob\b/.test(col.nk)) {
      continue;
    }

    const last10 = digitsOnlyLocal(col.value).slice(-10);
    if (!last10 || last10.length < 10 || usedLast10.has(last10)) continue;

    const ord = ordinalFromKeyClient(col.nk);
    if (ord && !String(slots[ord].phone || "").trim()) {
      assignBankerSlot(slots, ord, col.value, col.nk);
      usedLast10.add(last10);
      continue;
    }

    if (isLikelyBankerPhoneColumnClient(col.nk)) {
      queue.push(col);
    }
  }

  [1, 2, 3].forEach((slot) => {
    if (String(slots[slot].phone || "").trim()) return;
    while (queue.length) {
      const col = queue.shift();
      const last10 = digitsOnlyLocal(col.value).slice(-10);
      if (!last10 || usedLast10.has(last10)) continue;
      assignBankerSlot(slots, slot, col.value, col.nk);
      usedLast10.add(last10);
      break;
    }
  });

  sanitizeBankerSlots(slots);
  return slots;
}

function fillPhonesAfterBankerNameColumnsClient(excelFields, caseDoc, slots) {
  if (!slotNeedsPhoneFillClient(slots)) return slots;

  const loanDigitSet = collectLoanDigitSet(excelFields);
  const digitsOnlyLocal = (v) => String(v || "").replace(/\D/g, "");
  const isCustPhone = (value) => {
    const v = digitsOnlyLocal(value);
    if (v.length < 10) return false;
    const c = digitsOnlyLocal(caseDoc.mobileNumber);
    const a = digitsOnlyLocal(caseDoc.alternateMobileNumber);
    return (c && v.slice(-10) === c.slice(-10)) || (a && v.slice(-10) === a.slice(-10));
  };

  const cols = listExcelColumnsOrderedClient(excelFields);

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!isBankerNameHeaderClient(col.nk) && !col.nk.includes("bankar")) continue;

    let slot = ordinalFromKeyClient(col.nk);
    const nameVal = String(col.value || "").trim();
    if (!slot && nameVal) {
      slot = [1, 2, 3].find((s) => String(slots[s].name || "").trim() === nameVal);
    }
    if (!slot) continue;
    if (String(slots[slot].phone || "").trim()) continue;

    for (let j = i + 1; j < Math.min(cols.length, i + 4); j++) {
      const next = cols[j];
      if (isBankerNameHeaderClient(next.nk) && isNameLikeValue(next.value)) break;
      if (isLoanColumnKey(next.nk)) continue;
      if (!isPhoneLikeValue(next.value) || isCustPhone(next.value)) continue;
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

/** Financer columns: 1st banker name, 1st contact number, … */
function pickDirectFromExcelHeadersClient(excelFields) {
  const slots = {
    1: { name: "", phone: "" },
    2: { name: "", phone: "" },
    3: { name: "", phone: "" },
  };
  let loanNumber = "";

  for (const [key, val] of Object.entries(excelFields || {})) {
    const nk = normalizeExcelHeader(key);
    const v = String(val).trim();
    if (!v) continue;
    if (isLoanColumnKey(nk) || nk.includes("loan") || nk.includes("lan")) {
      if (isLoanAccountValue(v)) loanNumber = loanNumber || v;
      continue;
    }
    if (/^mobile(\s+no)?(\s+\d+)?$/.test(nk) || /^mob(ile)?\s*no(\s+\d+)?$/.test(nk)) {
      continue;
    }

    const ord = ordinalFromKeyClient(nk);
    if (!ord) continue;
    const isBankerCol = /banker|bankar|confirmer|recovery officer|\bro\b|field manager|\bfm\b/.test(
      nk
    );
    const isPhoneCol =
      /contact|phone|mobile|\bno\b|number/.test(nk) && !/customer|cust|borrower/.test(nk);
    if (isBankerCol || isPhoneCol || (/contact/.test(nk) && /banker|bankar|number|name/.test(nk))) {
      assignBankerSlot(slots, ord, v, nk);
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

function isExcludedAutoScanColumnClient(nk, value, caseDoc = {}) {
  if (
    nk.includes("cust name") ||
    nk.includes("customer name") ||
    nk.includes("vehicle") ||
    nk.includes("chassis") ||
    nk.includes("chasis") ||
    nk.includes("engine") ||
    nk === "make" ||
    nk === "model" ||
    nk.includes("cust contact") ||
    nk.includes("cust address")
  ) {
    return true;
  }
  if (nk.includes("loan") || nk.includes("agreement")) return true;
  if (nk.includes("bucket") || nk === "pos") return true;
  if ((nk === "branch" || nk.includes("branch name")) && !nk.includes("banker")) return true;
  if (nk === "finance" || nk.includes("agency")) return true;
  const cust = String(caseDoc.customerName || "")
    .trim()
    .toLowerCase();
  if (cust && String(value || "").trim().toLowerCase() === cust) return true;
  return false;
}

function isLooseBankerHeaderClient(nk) {
  return (
    isLikelyBankerPhoneColumnClient(nk) ||
    /banker|bankar|confirmer|confirmation|executive|field manager|\bfm\b|mailid|mail id|contact person|recovery|collection officer|nodal|telecaller|coordinator|signatory|^mobile no$/.test(
      nk
    ) ||
    (nk.includes("name") && /officer|manager|executive/.test(nk))
  );
}

function slotNeedsNameFillClient(slots) {
  return [1, 2, 3].some((i) => !String(slots[i]?.name || "").trim());
}

/** Fill empty banker slots by scanning any Excel column (unknown file layout). */
function autoScanBankerSlotsFromExcelClient(excelFields, caseDoc, slots) {
  if (!excelFields) return slots;
  if (!slotNeedsPhoneFillClient(slots) && !slotNeedsNameFillClient(slots)) return slots;

  const cols = listExcelColumnsOrderedClient(excelFields);

  const digitsOnlyLocal = (v) => String(v || "").replace(/\D/g, "");
  const isCustPhone = (value) => {
    const v = digitsOnlyLocal(value);
    if (v.length < 10) return false;
    const c = digitsOnlyLocal(caseDoc.mobileNumber);
    const a = digitsOnlyLocal(caseDoc.alternateMobileNumber);
    return (c && v.slice(-10) === c.slice(-10)) || (a && v.slice(-10) === a.slice(-10));
  };

  for (const c of cols) {
    if (isExcludedAutoScanColumnClient(c.nk, c.value, caseDoc)) continue;
    if (ordinalFromKeyClient(c.nk)) continue;
    if (!isLooseBankerHeaderClient(c.nk)) continue;
    const target = [1, 2, 3].find((i) => {
      if (isPhoneLikeValue(c.value)) return !String(slots[i].phone || "").trim();
      if (isNameLikeValue(c.value)) return !String(slots[i].name || "").trim();
      return !String(slots[i].name || "").trim() && !String(slots[i].phone || "").trim();
    });
    if (target) assignBankerSlot(slots, target, c.value, c.nk);
  }

  if (slotNeedsPhoneFillClient(slots) || slotNeedsNameFillClient(slots)) {
    const phones = [];
    const names = [];
    const seenPhoneLast10 = new Set();
    for (const c of cols) {
      if (isExcludedAutoScanColumnClient(c.nk, c.value, caseDoc)) continue;
      if (c.value.includes("@")) continue;
      if (isPhoneLikeValue(c.value) && !isCustPhone(c.value)) {
        const p10 = digitsOnlyLocal(c.value).slice(-10);
        if (p10.length >= 10 && !seenPhoneLast10.has(p10)) {
          seenPhoneLast10.add(p10);
          phones.push(c);
        }
      } else if (isNameLikeValue(c.value) && !isPhoneLikeValue(c.value)) {
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

/** Client-side auto-detect (mirrors backend excelBankerInference.js). */
function inferBankerContactsFromExcelClient(excelFields, caseDoc = {}) {
  const direct = pickDirectFromExcelHeadersClient(excelFields);
  const slots = {
    1: { name: direct.contactPerson1Name, phone: direct.contactPerson1Phone },
    2: { name: direct.contactPerson2Name, phone: direct.contactPerson2Phone },
    3: { name: direct.contactPerson3Name, phone: direct.contactPerson3Phone },
  };
  let loanVL = /^vl/i.test(direct.loanNumber) ? direct.loanNumber : "";
  let loanOther = !loanVL && direct.loanNumber ? direct.loanNumber : "";
  const byNorm = new Map();

  for (const [key, val] of Object.entries(excelFields || {})) {
    const value = String(val).trim();
    if (!value) continue;
    const nk = normalizeExcelHeader(key);
    const prev = byNorm.get(nk);
    if (!prev || String(key).length > String(prev.key || "").length) {
      byNorm.set(nk, { nk, value, key: String(key) });
    }
  }

  const digitsOnly = (v) => String(v || "").replace(/\D/g, "");
  const isCustPhone = (value) => {
    const v = digitsOnly(value);
    if (v.length < 10) return false;
    const c = digitsOnly(caseDoc.mobileNumber);
    const a = digitsOnly(caseDoc.alternateMobileNumber);
    return (c && v.slice(-10) === c.slice(-10)) || (a && v.slice(-10) === a.slice(-10));
  };

  const ordKey = (nk) => {
    if (/\b(1st|first|level 1|contact 1|mailid 1|mail 1)\b/.test(nk)) return 1;
    if (/\b(2nd|second|level 2|contact 2|mailid 2|mail 2)\b/.test(nk)) return 2;
    if (/\b(3rd|third|level 3|contact 3|mailid 3)\b/.test(nk)) return 3;
    return 0;
  };

  for (const { nk, value } of byNorm.values()) {
    if (
      nk.includes("cust name") ||
      nk.includes("customer name") ||
      nk.includes("vehicle") ||
      nk.includes("chassis") ||
      nk.includes("chasis") ||
      nk.includes("engine") ||
      nk === "make" ||
      nk === "model" ||
      nk.includes("cust contact") ||
      nk.includes("cust address")
    ) {
      continue;
    }

    const ord = ordKey(nk);

    if ((nk.includes("loan") || isLoanColumnKey(nk)) && !nk.includes("agreement")) {
      if (isLoanAccountValue(value)) {
        if (/^vl/i.test(value)) loanVL = value;
        else if (!loanOther) loanOther = value;
      }
      continue;
    }
    if (nk.includes("agreement") && isLoanAccountValue(value) && !loanVL) {
      loanOther = value;
      continue;
    }
    if (isLoanAccountValue(value) && /^vl/i.test(value) && !loanVL) {
      loanVL = value;
      continue;
    }

    if (!ord || !slots[ord]) continue;
    if (value.includes("@")) {
      if (!slots[ord].name) slots[ord].name = value;
      continue;
    }
    if (nk.includes("contact") && nk.includes("number") && isBankerMobileValue(value)) {
      assignBankerSlot(slots, ord, value, nk);
      continue;
    }
    if (isBankerMobileValue(value) && !isCustPhone(value)) {
      assignBankerSlot(slots, ord, value, nk);
      continue;
    }
    if (
      nk.includes("banker") ||
      nk.includes("level") ||
      nk.includes("mailid") ||
      nk.includes("confirmer") ||
      nk.includes("name")
    ) {
      assignBankerSlot(slots, ord, value, nk);
    }
  }

  autoScanBankerSlotsFromExcelClient(excelFields, caseDoc, slots);
  fillPhonesAfterBankerNameColumnsClient(excelFields, caseDoc, slots);
  fillMissingBankerPhonesFromExcelClient(excelFields, caseDoc, slots);
  sanitizeBankerSlots(slots);
  const s1 = sanitizeBankerPair(slots[1].name, slots[1].phone);
  const s2 = sanitizeBankerPair(slots[2].name, slots[2].phone);
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
    loanNumber,
  };
}

/** Merge API excelContacts onto a case/search item for display + share. */
export function mergeExcelContactsIntoCase(item = {}, excelContacts = {}) {
  if (!excelContacts || typeof excelContacts !== "object") return item;
  const base = item && typeof item === "object" ? { ...item } : {};
  const map = [
    ["contactPerson1Name", excelContacts.contactPerson1Name],
    ["contactPerson1Phone", excelContacts.contactPerson1Phone],
    ["contactPerson2Name", excelContacts.contactPerson2Name],
    ["contactPerson2Phone", excelContacts.contactPerson2Phone],
    ["contactPerson3Name", excelContacts.contactPerson3Name],
    ["contactPerson3Phone", excelContacts.contactPerson3Phone],
    ["bankNotifyEmail1", excelContacts.bankNotifyEmail1],
    ["bankNotifyEmail2", excelContacts.bankNotifyEmail2],
    ["loanAccountNumber", excelContacts.loanNumber],
  ];
  for (const [field, val] of map) {
    if (String(val || "").trim()) base[field] = String(val).trim();
  }
  return base;
}

/** All 7 banker rows — always present; value blank when missing. */
export function getAdminBankerRowsAlways(caseDoc = {}) {
  const b = getBankerFieldsFromCase(caseDoc);
  return ADMIN_BANKER_FIELD_DEFS.map(({ key, label }) => ({
    label,
    value: b[key] || "",
  }));
}

/** @deprecated use getAdminBankerRowsAlways */
export function getAdminBankerReferenceRows(item = {}) {
  return getAdminBankerRowsAlways(item);
}

/** LRMS / detail list — same 7 fields, blanks allowed. */
export function getAdminBankerLrmsRows(caseDoc = {}) {
  return getAdminBankerRowsAlways(caseDoc);
}

export const ADMIN_LRMS_CONTACT_LABELS_TO_HIDE = new Set([
  "Contact 1",
  "Contact 2",
  "Contact 3",
  "Cust Contact Nos",
]);
