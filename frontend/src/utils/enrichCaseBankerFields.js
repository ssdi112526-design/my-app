import { repoCaseService } from "../services/repoCase.service";
import { mergeExcelContactsIntoCase } from "./bankerExcelFields";
import { applyHydratedBankerContacts } from "./hydrateBankerContactsFromExcel";

/**
 * Load banker columns from uploaded Excel (via API) and merge onto case/search item.
 */
export async function enrichCaseWithBankerFields(item, token, caseId = null) {
  if (!token || !item) return item;

  try {
    const res = await repoCaseService.fetchBankNotifyMessage(token, {
      caseId: caseId || item._id || item.id,
      searchItem: item,
    });
    const data = res?.data;
    if (!data) return item;

    if (data.enrichedCase) {
      let merged = mergeExcelContactsIntoCase(data.enrichedCase, data.excelContacts);
      const order = data.excelColumnOrder;
      if (Array.isArray(order) && order.length) {
        merged.excelColumnOrder = order;
        const ef = merged.excelFields && typeof merged.excelFields === "object"
          ? { ...merged.excelFields }
          : {};
        if (!Array.isArray(ef._excelColumnOrder) || !ef._excelColumnOrder.length) {
          merged.excelFields = { ...ef, _excelColumnOrder: order };
        }
      }
      return applyHydratedBankerContacts(merged, merged.excelFields);
    }
    return applyHydratedBankerContacts(
      mergeExcelContactsIntoCase(item, data.excelContacts),
      item.excelFields
    );
  } catch {
    return applyHydratedBankerContacts(item, item?.excelFields);
  }
}
