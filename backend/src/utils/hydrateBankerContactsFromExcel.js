const { inferBankerContactsFromExcel } = require("./excelBankerInference");
const { resolveBankerPhonesFromExcel } = require("./bankerMobileFromExcel");

/**
 * Resolve banker names + mobiles from excelFields (duplicate "mobile no" columns supported).
 */
function hydrateBankerContactsFromExcelFields(excelFields = {}, caseDoc = {}) {
  const e = excelFields && typeof excelFields === "object" ? excelFields : {};
  const inferred = inferBankerContactsFromExcel(e, caseDoc);
  const bankers = {
    banker1Name: inferred.contactPerson1Name,
    banker1Phone: inferred.contactPerson1Phone,
    banker2Name: inferred.contactPerson2Name,
    banker2Phone: inferred.contactPerson2Phone,
    banker3Name: inferred.contactPerson3Name,
    banker3Phone: inferred.contactPerson3Phone,
  };
  const phones = resolveBankerPhonesFromExcel(e, caseDoc, bankers);

  return {
    contactPerson1Name: bankers.banker1Name || caseDoc.contactPerson1Name || "",
    contactPerson1Phone: phones[0] || "",
    contactPerson2Name: bankers.banker2Name || caseDoc.contactPerson2Name || "",
    contactPerson2Phone: phones[1] || "",
    contactPerson3Name: bankers.banker3Name || caseDoc.contactPerson3Name || "",
    contactPerson3Phone: phones[2] || "",
    bankNotifyEmail1: inferred.bankNotifyEmail1 || caseDoc.bankNotifyEmail1 || "",
    bankNotifyEmail2: inferred.bankNotifyEmail2 || caseDoc.bankNotifyEmail2 || "",
    loanNumber: inferred.loanNumber || caseDoc.loanAccountNumber || "",
  };
}

/** Apply banker contacts onto a case/search payload. */
function applyHydratedBankerContacts(doc = {}, excelFields = {}) {
  const base = doc && typeof doc === "object" ? { ...doc } : {};
  const e = excelFields && typeof excelFields === "object" ? excelFields : base.excelFields || {};
  const patch = hydrateBankerContactsFromExcelFields(e, base);

  base.excelFields = e;
  for (const [key, val] of Object.entries(patch)) {
    if (String(val || "").trim()) base[key] = String(val).trim();
  }
  return base;
}

module.exports = {
  hydrateBankerContactsFromExcelFields,
  applyHydratedBankerContacts,
};
