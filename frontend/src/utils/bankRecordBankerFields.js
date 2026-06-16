import { allExcelColumnsForDisplay } from "./bankRecordDisplay";
import { firstNonEmpty } from "./bankerExcelFields";
import { extractBankerContactsFromColumns } from "./bankerExcelExtract";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} from "./bankerValueUtils";

function sanitizeSnapshotValue(key, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (key.endsWith("Phone")) return coerceBankerPhoneDisplay(raw);
  if (key.endsWith("Name")) return coerceBankerNameDisplay(raw);
  return "";
}

export function getBankerRowsForBankRecord(record, excelCols = null) {
  const cols = excelCols || (record ? allExcelColumnsForDisplay(record) : []);
  const rows = extractBankerContactsFromColumns(cols);
  const snap = record?.extraFields?._bankerSnapshot;

  return rows.map((row) => {
    let value = row.value || "";
    if (!value && snap && typeof snap === "object") {
      value = sanitizeSnapshotValue(row.key, snap[row.key]);
    }
    if (row.key?.endsWith("Name")) {
      value = coerceBankerNameDisplay(value);
    } else if (row.key?.endsWith("Phone")) {
      value = coerceBankerPhoneDisplay(value);
    }
    return { ...row, value: value || "" };
  });
}

export function bankRecordToCaseShape(record = {}) {
  const extra =
    record.extraFields && typeof record.extraFields === "object" ? record.extraFields : {};

  return {
    excelFields: extra,
    customerName: record.borrowerName || "",
    mobileNumber: record.borrowerPhone || "",
    loanAccountNumber: record.loanAccountNumber || "",
    vehicleNumber: record.vehicleNumber || "",
    chassisNumber: record.chassisNumber || "",
    engineNumber: record.engineNumber || "",
    vehicleBrand: record.vehicleMake || "",
    vehicleModel: record.vehicleModel || "",
  };
}

export function getBankerFieldsFromBankRecord(record, excelCols = null) {
  const rows = getBankerRowsForBankRecord(record, excelCols);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    banker1Name: byKey.banker1Name || "",
    banker1Phone: byKey.banker1Phone || "",
    banker2Name: byKey.banker2Name || "",
    banker2Phone: byKey.banker2Phone || "",
    banker3Name: byKey.banker3Name || "",
    banker3Phone: byKey.banker3Phone || "",
    loanNumber: record?.loanAccountNumber || "",
  };
}

export function getBankRecordNotifyContacts(record) {
  const bankers = getBankerFieldsFromBankRecord(record);
  const extra = record?.extraFields || {};
  const notifyPhone = firstNonEmpty(
    bankers.banker1Phone,
    bankers.banker2Phone,
    bankers.banker3Phone
  );
  let notifyEmail = "";
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    const text = String(val || "").trim();
    if (text.includes("@") && /mail|email/i.test(key)) {
      notifyEmail = text;
      break;
    }
  }
  if (!notifyEmail && record.uploadedBy?.email) {
    notifyEmail = record.uploadedBy.email;
  }
  return { notifyPhone, notifyEmail };
}
