function normalizeExcelHeader(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
}

function pickExcelField(excelFields, aliases = []) {
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

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return "";
}

const { inferBankerContactsFromExcel } = require("./excelBankerInference");
const { isBankerMobileValue, isLoanAccountValue } = require("./bankerValueUtils");
const { sanitizeBankerPair } = require("./bankerValueUtils");

/**
 * Bank / authority contacts from Excel row (not customer mobile).
 */
function extractExcelNotifyContacts(caseDoc) {
  const doc = caseDoc && typeof caseDoc === "object" ? caseDoc : {};
  const e = doc.excelFields || {};
  const inferred =
    Object.keys(e).length > 0 ? inferBankerContactsFromExcel(e, doc) : {};

  // Prefer auto-scanned Excel values when mapped/admin fields are empty.
  const contactPerson1Name = firstNonEmpty(
    doc.contactPerson1Name,
    inferred.contactPerson1Name,
    pickExcelField(e, [
      "1st banker name",
      "first banker name",
      "contact person 1 name",
      "contact person 1",
      "level 1",
      "1st confirmer",
      "first confirmer",
      "confirmation person 1",
      "confirmation name 1",
      "confirmation 1 name",
      "confirmer 1 name",
    ])
  );

  const contactPerson1Phone = firstNonEmpty(
    doc.contactPerson1Phone,
    inferred.contactPerson1Phone,
    pickExcelField(e, [
      "1st mobile no",
      "mobile no 1",
      "mobile no_1",
      "1st contact number",
      "first contact number",
      "contact person 1 number",
      "contact person 1 mobile",
      "contact person 1 phone",
      "1st confirmer no",
      "1st confirmer number",
      "contact 1",
      "contact 1 number",
      "confirmation number 1",
      "confirmation no 1",
      "confirmation 1 number",
      "confirmer 1 number",
    ])
  );

  const contactPerson2Name = firstNonEmpty(
    doc.contactPerson2Name,
    inferred.contactPerson2Name,
    pickExcelField(e, [
      "2nd banker name",
      "second banker name",
      "2nd banker",
      "contact person 2 name",
      "contact person 2",
      "level 2",
      "2nd confirmer",
      "second confirmer",
      "confirmation person 2",
      "confirmation name 2",
      "confirmation 2 name",
      "confirmer 2 name",
    ])
  );

  const contactPerson2Phone = firstNonEmpty(
    doc.contactPerson2Phone,
    inferred.contactPerson2Phone,
    pickExcelField(e, [
      "2nd mobile no",
      "mobile no 2",
      "mobile no_2",
      "2nd contact number",
      "second contact number",
      "contact person 2 number",
      "contact person 2 mobile",
      "contact person 2 phone",
      "2nd confirmer no",
      "2nd confirmer number",
      "contact 2",
      "contact 2 number",
      "confirmation number 2",
      "confirmation no 2",
      "confirmation 2 number",
      "confirmer 2 number",
    ])
  );

  const contactPerson3Name = firstNonEmpty(
    doc.contactPerson3Name,
    inferred.contactPerson3Name,
    pickExcelField(e, [
      "3rd banker name",
      "third banker name",
      "3rd banker",
      "third banker",
      "contact person 3 name",
      "contact person 3",
      "3rd confirmer",
      "third confirmer",
    ])
  );

  const contactPerson3Phone = firstNonEmpty(
    doc.contactPerson3Phone,
    inferred.contactPerson3Phone,
    pickExcelField(e, [
      "3rd mobile no",
      "mobile no 3",
      "mobile no_3",
      "3rd contact number",
      "third contact number",
      "contact person 3 number",
      "contact person 3 mobile",
      "contact person 3 phone",
      "3rd confirmer no",
      "third confirmer no",
      "contact 3",
      "contact 3 number",
    ])
  );

  const loanFromDoc = String(doc.loanAccountNumber || "").trim();
  const loanCandidates = [
    inferred.loanNumber,
    loanFromDoc,
    pickExcelField(e, ["loan number", "loan account number", "loan no", "lan", "lan no"]),
    pickExcelField(e, ["agreement number", "agreement no"]),
  ];
  let loanNumber = "";
  for (const c of loanCandidates) {
    const s = String(c || "").trim();
    if (s && isLoanAccountValue(s)) {
      loanNumber = s;
      break;
    }
  }

  const bankNotifyEmail1 = firstNonEmpty(
    doc.bankNotifyEmail1,
    inferred.bankNotifyEmail1,
    pickExcelField(e, ["mailid 1", "mail id 1", "email 1", "bank email", "email"])
  );

  const bankNotifyEmail2 = firstNonEmpty(
    doc.bankNotifyEmail2,
    inferred.bankNotifyEmail2,
    pickExcelField(e, ["mailid 2", "mail id 2", "email 2", "bank email 2"])
  );

  const s1 = sanitizeBankerPair(contactPerson1Name, contactPerson1Phone);
  const s2 = sanitizeBankerPair(contactPerson2Name, contactPerson2Phone);
  const s3 = sanitizeBankerPair(contactPerson3Name, contactPerson3Phone);

  return {
    contactPerson1Name: s1.name,
    contactPerson1Phone: s1.phone,
    contactPerson2Name: s2.name,
    contactPerson2Phone: s2.phone,
    contactPerson3Name: s3.name,
    contactPerson3Phone: s3.phone,
    loanNumber,
    bankNotifyEmail1,
    bankNotifyEmail2,
  };
}

const ADMIN_BANKER_ROW_DEFS = [
  { label: "1st banker name", key: "contactPerson1Name" },
  { label: "1st contact number", key: "contactPerson1Phone" },
  { label: "2nd banker name", key: "contactPerson2Name" },
  { label: "2nd contact number", key: "contactPerson2Phone" },
  { label: "3rd banker name", key: "contactPerson3Name" },
  { label: "3rd contact number", key: "contactPerson3Phone" },
  { label: "Loan Number", key: "loanNumber" },
];

/** Rows for admin bank notify — always 7 lines; blank if Excel has no value. */
function getAdminBankerReferenceRows(caseDoc = {}) {
  const c = extractExcelNotifyContacts(caseDoc);
  return ADMIN_BANKER_ROW_DEFS.map(({ label, key }) => ({
    label,
    value: String(c[key] || "").trim(),
  }));
}

function buildRecipientOptions(caseDoc = {}, branchContacts = {}) {
  const excel = extractExcelNotifyContacts(caseDoc);
  const options = [];

  const branchPhone = String(branchContacts.notifyPhone || "").trim();
  const branchEmail = String(branchContacts.notifyEmail || "").trim();
  if (branchPhone || branchEmail) {
    options.push({
      id: "branch",
      label: "Bank branch authority (Banks setup)",
      name: "",
      phone: branchPhone,
      email: branchEmail,
    });
  }

  if (excel.contactPerson1Name || excel.contactPerson1Phone || excel.bankNotifyEmail1) {
    options.push({
      id: "cp1",
      label: "1st banker (Excel)",
      name: excel.contactPerson1Name,
      phone: excel.contactPerson1Phone,
      email: excel.bankNotifyEmail1,
    });
  }

  if (excel.contactPerson2Name || excel.contactPerson2Phone || excel.bankNotifyEmail2) {
    options.push({
      id: "cp2",
      label: "2nd banker (Excel)",
      name: excel.contactPerson2Name,
      phone: excel.contactPerson2Phone,
      email: excel.bankNotifyEmail2,
    });
  }

  if (excel.contactPerson3Name || excel.contactPerson3Phone) {
    options.push({
      id: "cp3",
      label: "3rd banker (Excel)",
      name: excel.contactPerson3Name,
      phone: excel.contactPerson3Phone,
      email: "",
    });
  }

  options.push({
    id: "custom",
    label: "Other (enter manually)",
    name: "",
    phone: "",
    email: "",
  });

  const defaultId =
    (options.find((o) => o.id === "cp1" && o.phone)?.id) ||
    (options.find((o) => o.id === "branch" && o.phone)?.id) ||
    options[0]?.id ||
    "custom";

  const selected = options.find((o) => o.id === defaultId) || options[0];

  return {
    options,
    defaultRecipientId: defaultId,
    suggestedPhone: selected?.phone || "",
    suggestedEmail: selected?.email || "",
    excel,
  };
}

function hasBankerNotifyContacts(contacts = {}) {
  return Boolean(
    String(contacts.contactPerson1Name || "").trim() ||
      String(contacts.contactPerson1Phone || "").trim() ||
      String(contacts.contactPerson2Name || "").trim() ||
      String(contacts.contactPerson2Phone || "").trim() ||
      String(contacts.contactPerson3Name || "").trim() ||
      String(contacts.contactPerson3Phone || "").trim()
  );
}

/** Copy resolved banker fields onto case doc for message building + API response. */
function applyExcelContactsToCase(caseDoc = {}) {
  const { applyHydratedBankerContacts } = require("./hydrateBankerContactsFromExcel");
  return applyHydratedBankerContacts(caseDoc, caseDoc.excelFields);
}

module.exports = {
  pickExcelField,
  extractExcelNotifyContacts,
  getAdminBankerReferenceRows,
  buildRecipientOptions,
  hasBankerNotifyContacts,
  applyExcelContactsToCase,
};
