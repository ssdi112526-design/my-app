import { formatCoreFieldDisplay } from "./bankRecordDisplay";
import { getBankerRowsForBankRecord } from "./bankRecordBankerFields";
import { filterBankRecordExcelRows } from "./bankRecordFieldVisibility";
import { allExcelColumnsForDisplay } from "./bankRecordDisplay";
import { adminContactFromUser } from "./bankNotifyShare";

function safeLine(value) {
  const t = String(value ?? "").trim();
  return t && t !== "—" ? t : "";
}

export function buildBankRecordShareMessage(record, { role, authUser, direction = "toBanker" } = {}) {
  const lines = [];
  const admin = adminContactFromUser(authUser);
  const vehicle = formatCoreFieldDisplay(record, "vehicleNumber");

  if (direction === "toBanker") {
    lines.push("Respected Sir,");
    lines.push("");
    lines.push("Please find an update regarding a recovery case from our agency:");
    lines.push("");
  } else {
    lines.push("Bank record update — field report");
    lines.push("");
  }

  lines.push(`Vehicle: ${vehicle}`);
  const borrower = formatCoreFieldDisplay(record, "borrowerName");
  if (borrower !== "—") lines.push(`Customer: ${borrower}`);
  const phone = formatCoreFieldDisplay(record, "borrowerPhone");
  if (phone !== "—") lines.push(`Customer mobile: ${phone}`);

  const loan = formatCoreFieldDisplay(record, "loanAccountNumber");
  if (loan !== "—") lines.push(`Loan account: ${loan}`);

  const bankerRows = getBankerRowsForBankRecord(record);
  const bankerBlock = bankerRows.filter((r) => safeLine(r.value));
  if (bankerBlock.length) {
    lines.push("");
    lines.push("Banker reference:");
    bankerBlock.forEach(({ label, value }) => {
      lines.push(`${label}: ${value}`);
    });
  }

  const excelRows = filterBankRecordExcelRows(
    allExcelColumnsForDisplay(record),
    role || "REPO_ADMIN"
  ).filter((r) => safeLine(r.value));

  if (excelRows.length) {
    lines.push("");
    lines.push("Additional details:");
    excelRows.slice(0, 12).forEach(({ label, value }) => {
      lines.push(`${label}: ${value}`);
    });
  }

  if (direction === "toAdmin" && admin?.name) {
    lines.push("");
    lines.push("— Reported by —");
    lines.push(`Name: ${admin.name}`);
    if (admin.phone) lines.push(`Mobile: ${admin.phone}`);
  }

  if (direction === "toBanker") {
    lines.push("");
    lines.push("Kindly confirm status at your earliest.");
    lines.push("");
    lines.push("Thank you & regards,");
    if (admin?.name) lines.push(admin.name);
    if (admin?.phone) lines.push(`Mobile: ${admin.phone}`);
  }

  return lines.join("\n");
}

export function openBankRecordShare(type, record, contacts, options = {}) {
  const { authUser, role, direction = "toBanker" } = options;
  const message = buildBankRecordShareMessage(record, { role, authUser, direction });
  const vehicle = formatCoreFieldDisplay(record, "vehicleNumber");
  const subject =
    direction === "toBanker"
      ? `Recovery update — ${vehicle}`
      : `Field update — ${vehicle}`;

  const phone = String(contacts.notifyPhone || "").replace(/\D/g, "");
  const email = String(contacts.notifyEmail || "").trim();

  if (type === "whatsapp") {
    const waPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (type === "email") {
    const to = email ? encodeURIComponent(email) : "";
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    return;
  }

  if (type === "sms") {
    const digits = phone.length === 10 ? `91${phone}` : phone;
    const href = digits
      ? `sms:+${digits}?body=${encodeURIComponent(message)}`
      : `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = href;
    return;
  }
}
