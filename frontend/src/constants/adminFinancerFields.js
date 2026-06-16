import { getFullAddress } from "../pages/repo/vehicles/findVehiclesHelpers";
import { pickExcelField } from "../utils/bankerExcelFields";
import { resolveBankerPhonesFromExcel } from "../utils/bankerMobileFromExcel";
import { isBankerMobileValue, isLoanAccountValue } from "../utils/bankerValueUtils";
import {
  formatVehicleNumberDisplay,
  normalizeVehicleNumber,
} from "../utils/vehicleNumberUtils";

function firstNonEmpty(...values) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s && s !== "-") return s;
  }
  return "";
}

function pickDocOrExcel(doc, e, excelAliases = [], docKeys = []) {
  for (const key of docKeys) {
    const v = doc[key];
    if (v !== null && v !== undefined && String(v).trim()) {
      return String(v).trim();
    }
  }
  return pickExcelField(e, excelAliases);
}

function resolveRegistration(doc, e) {
  const fromExcel = pickExcelField(e, [
    "registration number",
    "registration numbers",
    "vehicle number",
    "reg no",
  ]);
  const vehicle = formatVehicleNumberDisplay(doc.vehicleNumber);
  const vehicleNorm = normalizeVehicleNumber(doc.vehicleNumber);
  const excelNorm = normalizeVehicleNumber(fromExcel);
  if (vehicle && vehicle !== "—") {
    if (!fromExcel) return vehicle;
    if (vehicleNorm.length >= 6 && excelNorm.length < vehicleNorm.length) {
      return vehicle;
    }
  }
  return firstNonEmpty(fromExcel, vehicle !== "—" ? vehicle : "");
}

/**
 * Fixed admin display order (SK financer sheet).
 * Values come from uploaded Excel headers + bank/branch from upload form.
 * TBR and Allocation are excluded.
 */
export const ADMIN_FINANCER_DISPLAY_FIELDS = [
  { key: "registration", label: "Registration Numbers" },
  {
    key: "customerName",
    label: "Customer Name",
    excel: ["customer name", "cust name", "borrower name"],
    doc: ["customerName"],
  },
  { key: "banker1Name", label: "1st bankar Name" },
  { key: "banker1Phone", label: "mobile no 1" },
  { key: "banker2Name", label: "2nd bankar Name" },
  { key: "banker2Phone", label: "mobile no 2" },
  { key: "banker3Name", label: "3rd bankar Name" },
  { key: "banker3Phone", label: "mobile no 3" },
  { key: "loan", label: "Loan Number" },
  {
    key: "make",
    label: "Make",
    excel: ["make", "model make", "make model"],
    doc: ["vehicleBrand"],
  },
  {
    key: "engine",
    label: "Engine Number",
    excel: ["engine number", "engine no"],
    doc: ["engineNumber"],
  },
  {
    key: "chassis",
    label: "Chasis Number",
    excel: ["chasis number", "chassis number", "chassis no"],
    doc: ["chassisNumber"],
  },
  { key: "model", label: "Model", excel: ["model"], doc: ["vehicleModel"] },
  { key: "emi", label: "EMI", excel: ["emi"], doc: ["emiAmount"] },
  { key: "pos", label: "POS", excel: ["pos"], doc: ["totalOutstandingAmount"] },
  {
    key: "instalment",
    label: "instalment",
    excel: ["instalment", "installment", "instalments", "bucket"],
    defaultValue: "1",
  },
  {
    key: "address",
    label: "Address",
    excel: [
      "address",
      "cust address",
      "customer address",
      "sec 17",
      "sec17",
      "section 17",
    ],
  },
  { key: "seasoning", label: "Seasoning", excel: ["seasoning"] },
  { key: "bankName", label: "Bank Name", doc: ["bankName"] },
  { key: "branchName", label: "Branch Name", doc: ["branchName"] },
];

function resolveBankerPhone(slotIndex, bankers, doc, e, strictLoanMobile) {
  const phones = resolveBankerPhonesFromExcel(e, doc, bankers);
  const p = phones[slotIndex - 1] || "";
  if (!strictLoanMobile) return p;
  return isBankerMobileValue(p) ? p : "";
}

function resolveFieldValue(def, doc, e, bankers, loanResolved, { strictLoanMobile = false } = {}) {
  const key = def.key;

  if (key === "registration") {
    return resolveRegistration(doc, e);
  }

  if (key === "customerName") {
    return pickDocOrExcel(doc, e, def.excel, def.doc);
  }

  if (key === "banker1Name") return bankers.banker1Name || "";
  if (key === "banker2Name") return bankers.banker2Name || "";
  if (key === "banker3Name") return bankers.banker3Name || "";

  if (key === "banker1Phone") return resolveBankerPhone(1, bankers, doc, e, strictLoanMobile);
  if (key === "banker2Phone") return resolveBankerPhone(2, bankers, doc, e, strictLoanMobile);
  if (key === "banker3Phone") return resolveBankerPhone(3, bankers, doc, e, strictLoanMobile);

  if (key === "loan") {
    const fromExcel = pickExcelField(e, [
      "loan number",
      "loan no",
      "lan",
      "lan no",
      "agreement number",
    ]);
    if (fromExcel) {
      if (!strictLoanMobile || isLoanAccountValue(fromExcel)) return fromExcel;
    }
    return loanResolved || "";
  }

  if (key === "make") {
    const fromExcel = pickDocOrExcel(doc, e, def.excel, def.doc);
    if (fromExcel) return fromExcel;
    const parts = [doc.vehicleBrand, doc.vehicleModel].filter(Boolean);
    return parts.join(" | ");
  }

  if (key === "address") {
    const fromExcel = pickDocOrExcel(doc, e, def.excel, []);
    if (fromExcel) return fromExcel;
    const addr = getFullAddress(doc);
    return addr !== "—" ? addr : "";
  }

  if (key === "instalment") {
    const v = pickDocOrExcel(doc, e, def.excel, []);
    return v || def.defaultValue || "1";
  }

  if (key === "bankName" || key === "branchName") {
    return pickDocOrExcel(doc, e, def.excel || [], def.doc || []);
  }

  return pickDocOrExcel(doc, e, def.excel || [], def.doc || []);
}

export function buildCanonicalAdminFinancerRows(
  caseDoc = {},
  bankers = {},
  loanResolved = "",
  options = {}
) {
  const doc = caseDoc && typeof caseDoc === "object" ? caseDoc : {};
  const e = doc.excelFields || {};

  return ADMIN_FINANCER_DISPLAY_FIELDS.map((def) => ({
    label: def.label,
    value: resolveFieldValue(def, doc, e, bankers, loanResolved, options),
  }));
}
