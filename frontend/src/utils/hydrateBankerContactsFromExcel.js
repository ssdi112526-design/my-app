import { getBankerFieldsFromCase } from "./bankerExcelFields";
import { resolveBankerPhonesFromExcel } from "./bankerMobileFromExcel";

/**
 * Resolve banker names + mobiles for admin display (client-side fallback).
 */
export function hydrateBankerContactsFromExcelFields(excelFields = {}, caseDoc = {}) {
  const e = excelFields && typeof excelFields === "object" ? excelFields : {};
  const bankers = getBankerFieldsFromCase({ ...caseDoc, excelFields: e });
  const phones = resolveBankerPhonesFromExcel(e, caseDoc, bankers);

  return {
    banker1Name: bankers.banker1Name,
    banker1Phone: phones[0] || bankers.banker1Phone || "",
    banker2Name: bankers.banker2Name,
    banker2Phone: phones[1] || bankers.banker2Phone || "",
    banker3Name: bankers.banker3Name,
    banker3Phone: phones[2] || bankers.banker3Phone || "",
    contactPerson1Phone: phones[0] || "",
    contactPerson2Phone: phones[1] || "",
    contactPerson3Phone: phones[2] || "",
  };
}

export function applyHydratedBankerContacts(doc = {}, excelFields = {}) {
  const base = doc && typeof doc === "object" ? { ...doc } : {};
  const e = excelFields && typeof excelFields === "object" ? excelFields : base.excelFields || {};
  const patch = hydrateBankerContactsFromExcelFields(e, base);

  base.excelFields = e;
  base.contactPerson1Phone = patch.contactPerson1Phone || base.contactPerson1Phone;
  base.contactPerson2Phone = patch.contactPerson2Phone || base.contactPerson2Phone;
  base.contactPerson3Phone = patch.contactPerson3Phone || base.contactPerson3Phone;
  if (patch.banker1Name) base.contactPerson1Name = patch.banker1Name;
  if (patch.banker2Name) base.contactPerson2Name = patch.banker2Name;
  if (patch.banker3Name) base.contactPerson3Name = patch.banker3Name;

  return base;
}
