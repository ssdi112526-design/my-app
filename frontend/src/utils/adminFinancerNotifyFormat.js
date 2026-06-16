import { safeValue } from "../pages/repo/vehicles/findVehiclesHelpers";
import { buildAdminExcelDisplayRows } from "./excelSheetDisplay";

/** Message rows in the same order as the uploaded Excel sheet. */
export function buildAdminFinancerMessageRows(caseDoc = {}) {
  return buildAdminExcelDisplayRows(caseDoc, { strictLoanMobile: true }).map(({ label, value }) => ({
    label,
    value: safeValue(value),
  }));
}

export function appendAdminFinancerMessageBody(lines, caseDoc = {}) {
  buildAdminFinancerMessageRows(caseDoc).forEach(({ label, value }) => {
    const text = safeValue(value);
    lines.push(`${label}: ${text === "—" ? "" : text}`);
  });
  lines.push("");
}
