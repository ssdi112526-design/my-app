import { getFullAddress, safeValue } from "../pages/repo/vehicles/findVehiclesHelpers";
import { repoCaseService } from "../services/repoCase.service";
import { mergeExcelContactsIntoCase } from "./bankerExcelFields";
import { appendAdminFinancerMessageBody } from "./adminFinancerNotifyFormat";

const ROLE_LABELS = {
  REPO_ADMIN: "Repo Admin",
  TEAM_LEADER: "Team Leader",
  HEAD_OFFICE_STAFF: "Head Office Staff",
  OFFICE_STAFF: "Office Staff",
  REPO_STAFF: "Repo Staff",
  REPO_VIEWER: "Repo Viewer",
};

function formatRole(role) {
  if (!role) return "";
  return ROLE_LABELS[role] || String(role).replace(/_/g, " ");
}

const CASE_FIELD_ROWS = [
  { label: "Registration Numbers", get: (c) => safeValue(c.vehicleNumber) },
  { label: "Customer Name", get: (c) => safeValue(c.customerName) },
  { label: "Father Name", get: (c) => safeValue(c.fatherName) },
  { label: "Mobile Number", get: (c) => safeValue(c.mobileNumber) },
  { label: "Alternate Mobile Number", get: (c) => safeValue(c.alternateMobileNumber) },
  { label: "Loan Account Number", get: (c) => safeValue(c.loanAccountNumber) },
  { label: "Reference Number", get: (c) => safeValue(c.referenceNumber) },
  { label: "Case Code", get: (c) => safeValue(c.caseCode) },
  { label: "Engine Number", get: (c) => safeValue(c.engineNumber) },
  { label: "Chassis Number", get: (c) => safeValue(c.chassisNumber) },
  { label: "Vehicle Brand", get: (c) => safeValue(c.vehicleBrand) },
  { label: "Vehicle Model", get: (c) => safeValue(c.vehicleModel) },
  { label: "Vehicle Type", get: (c) => safeValue(c.vehicleType) },
  { label: "Registration State", get: (c) => safeValue(c.registrationState) },
  { label: "Bank Name", get: (c) => safeValue(c.bankName) },
  { label: "Branch Name", get: (c) => safeValue(c.branchName) },
  { label: "Full Address", get: (c) => getFullAddress(c) },
  { label: "City", get: (c) => safeValue(c.city) },
  { label: "District", get: (c) => safeValue(c.district) },
  { label: "State", get: (c) => safeValue(c.state) },
  { label: "Pincode", get: (c) => safeValue(c.pincode) },
  { label: "EMI Amount", get: (c) => safeValue(c.emiAmount) },
  { label: "Due Amount", get: (c) => safeValue(c.dueAmount) },
  { label: "Outstanding Amount", get: (c) => safeValue(c.totalOutstandingAmount) },
  { label: "Bucket", get: (c) => safeValue(c.bucket) },
  { label: "Priority", get: (c) => safeValue(c.priority) },
  { label: "Field Notes", get: (c) => safeValue(c.fieldNotes) },
  {
    label: "Loaded details",
    get: (c) => safeValue(c.loadedDetail || c.loadedShort),
  },
  { label: "Repo Status", get: (c) => safeValue(c.repoStatus) },
  { label: "Confirmation Status", get: (c) => safeValue(c.confirmationStatus) },
];

/** Omitted from WhatsApp / SMS / email and other shared messages. */
const MESSAGE_EXCLUDED_LABELS = new Set([
  "Loan Account Number",
  "Bank Name",
  "Branch Name",
  "Priority",
  "Repo Status",
  "Confirmation Status",
]);

const BANK_NOTIFY_EXCLUDED_LABELS = MESSAGE_EXCLUDED_LABELS;

const BANK_NOTIFY_FIELD_ROWS = CASE_FIELD_ROWS.filter(
  (row) => !MESSAGE_EXCLUDED_LABELS.has(row.label)
);

const MESSAGE_FIELD_ROWS = CASE_FIELD_ROWS.filter(
  (row) => !MESSAGE_EXCLUDED_LABELS.has(row.label)
);

export function adminContactFromUser(authUser) {
  if (!authUser) return null;
  return {
    name: String(authUser.name || "").trim(),
    phone: String(authUser.phone || "").trim(),
  };
}

/** Extra fields for POST /notify-bank-traced so server message includes admin contact. */
export function buildNotifyBankApiPayload(channel, authUser, extras = {}) {
  const admin = adminContactFromUser(authUser);
  return {
    channel,
    ...extras,
    ...(admin
      ? { adminName: admin.name, adminPhone: admin.phone }
      : {}),
  };
}

function appendBankNotifyIntro(lines, context = {}) {
  const agencyName = safeValue(context.agency?.name);
  lines.push("Respected Sir,");
  lines.push("");
  if (agencyName) {
    lines.push(`Greetings from ${agencyName}.`);
    lines.push("");
  }
  lines.push(
    "A vehicle has been traced out by our ground team. The details of the vehicle and customer are as below:"
  );
  lines.push("");
}

function appendBankNotifyFooter(lines, context = {}) {
  const agencyName = safeValue(context.agency?.name);
  const contactName = safeValue(context.admin?.name);
  const contactPhone = safeValue(context.admin?.phone);

  lines.push("");
  lines.push(
    "We urgently need you to confirm the status of this vehicle, whether it is to be repossessed or released."
  );
  lines.push("");
  lines.push("Thank you & regards,");
  lines.push("");

  if (agencyName) {
    lines.push(agencyName);
  }
  if (contactName) {
    lines.push(`Contact person: ${contactName}`);
  }
  if (contactPhone) {
    lines.push(`Mobile: ${contactPhone}`);
  }
}

export function buildNotifyContextFromCase(caseData, authUser, company = null) {
  const traced = caseData?.latestTraceReport;
  const companyName =
    company?.companyName || authUser?.company?.companyName || "";
  return {
    tracedBy: traced
      ? {
          name: traced.requestedByName,
          role: traced.requestedByRole,
          roleLabel: formatRole(traced.requestedByRole),
          phone: traced.requestedByPhone,
          note: traced.requestNote,
          at: traced.reportedAt,
        }
      : null,
    admin: adminContactFromUser(authUser),
    agency: companyName ? { name: companyName } : null,
    includeAdminBankerRef: true,
  };
}

export function buildNotifyContextFromConfirmation(caseData, confirmation, authUser, company = null) {
  const companyName =
    company?.companyName || authUser?.company?.companyName || "";
  return {
    tracedBy: confirmation
      ? {
          name: confirmation.requestedByName,
          role: confirmation.requestedByRole,
          roleLabel:
            confirmation.requestedByRoleLabel || formatRole(confirmation.requestedByRole),
          phone: confirmation.requestedByPhone,
          note: confirmation.requestNote,
          at: confirmation.createdAt,
        }
      : null,
    admin: adminContactFromUser(authUser),
    agency: companyName ? { name: companyName } : null,
    includeAdminBankerRef: true,
  };
}

export function getTraceReportToAdminMessage(item, reporter = {}, extra = {}) {
  const lines = ["Vehicle Traced — Report to Admin", ""];
  MESSAGE_FIELD_ROWS.forEach(({ label, get }) => {
    const value = get(item);
    if (value && value !== "-") lines.push(`${label}: ${value}`);
  });
  if (reporter.name) {
    lines.push("");
    lines.push("--- Traced by (field / team report) ---");
    lines.push(`Name: ${reporter.name}`);
    if (reporter.roleLabel || reporter.role) {
      lines.push(`Role: ${reporter.roleLabel || formatRole(reporter.role)}`);
    }
    if (reporter.phone) lines.push(`Mobile: ${reporter.phone}`);
    if (extra.requestNote) lines.push(`Field note: ${extra.requestNote}`);
  }
  return lines.join("\n");
}

/** Bank / external notify — financer Excel layout for admin (WhatsApp / SMS / email). */
export function getBankTracedShareMessage(item, context = {}) {
  const lines = [];
  appendBankNotifyIntro(lines, context);

  if (context.includeAdminBankerRef === false) {
    BANK_NOTIFY_FIELD_ROWS.forEach(({ label, get }) => {
      const value = get(item);
      if (value && value !== "-") {
        lines.push(`${label}: ${value}`);
      }
    });
  } else {
    appendAdminFinancerMessageBody(lines, item);
  }

  appendBankNotifyFooter(lines, context);
  return lines.join("\n");
}

function normalizePhoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export async function copyBankNotifyMessage(message) {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}

export function openWhatsAppUrl(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Staff trace report — opens WhatsApp / email / SMS with full vehicle + tracer details. */
export function openTraceReportShare(type, item, reporter = {}, extra = {}) {
  const message = getTraceReportToAdminMessage(item, reporter, extra);
  const registration = item?.vehicleNumber || "";
  const subject = `Vehicle traced — ${registration}`;

  if (type === "whatsapp") {
    copyBankNotifyMessage(message);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    openWhatsAppUrl(url);
    return { copied: true };
  }

  if (type === "email") {
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    return {};
  }

  if (type === "sms") {
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
    return {};
  }

  return {};
}

async function resolveBankNotifyMessage(item, context = {}, token, contacts = {}, options = {}) {
  if (token) {
    try {
      const res = await repoCaseService.fetchBankNotifyMessage(token, {
        caseId: options.caseId || item?._id || item?.id,
        searchItem: item,
        adminName: context?.admin?.name,
        adminPhone: context?.admin?.phone,
        notifyPhone: contacts.notifyPhone,
        notifyEmail: contacts.notifyEmail,
      });
      if (res?.data?.message) {
        return {
          message: res.data.message,
          subject: res.data.subject || "",
          enrichedItem: mergeExcelContactsIntoCase(
            res.data.enrichedCase || item,
            res.data.excelContacts
          ),
          notifyPhone:
            String(contacts.notifyPhone || "").trim() ||
            String(res.data.bankNotifyPhone || "").trim(),
          notifyEmail:
            String(contacts.notifyEmail || "").trim() ||
            String(res.data.bankNotifyEmail || "").trim(),
        };
      }
    } catch {
      /* use local template */
    }
  }
  const registration = item?.vehicleNumber || "";
  return {
    message: getBankTracedShareMessage(item, context),
    subject: `Vehicle traced — confirmation required — ${registration}`,
    notifyPhone: String(contacts.notifyPhone || "").trim(),
    notifyEmail: String(contacts.notifyEmail || "").trim(),
  };
}

export async function openBankNotifyShare(
  type,
  item,
  contacts = {},
  context = {},
  options = {}
) {
  const { token, caseId } = options;
  const resolved = await resolveBankNotifyMessage(item, context, token, contacts, {
    caseId,
  });
  const { message, subject } = resolved;
  const phone = resolved.notifyPhone || "";
  const email = resolved.notifyEmail || "";

  if (type === "whatsapp") {
    copyBankNotifyMessage(message);
    const digits = normalizePhoneDigits(phone);
    const waPhone = digits.length === 10 ? `91${digits}` : digits;
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    openWhatsAppUrl(url);
    return { copied: true };
  }

  if (type === "email") {
    const to = email ? encodeURIComponent(email) : "";
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    return {};
  }

  if (type === "sms") {
    const digits = normalizePhoneDigits(phone);
    const href = digits
      ? `sms:+${digits.length === 10 ? `91${digits}` : digits}?body=${encodeURIComponent(message)}`
      : `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = href;
    return {};
  }

  return {};
}

export function formatNotifyApiResult(results) {
  if (!results) return "Sent.";
  const parts = [];
  if (results.email?.ok) parts.push("Email sent automatically");
  else if (results.email?.skipped) parts.push(`Email: ${results.email.reason || "skipped"}`);
  else if (results.email) parts.push(`Email: ${results.email.error || "failed"}`);
  if (results.sms?.ok) parts.push("SMS sent automatically");
  else if (results.sms?.skipped) parts.push(`SMS: ${results.sms.reason || "skipped"}`);
  else if (results.sms) parts.push(`SMS: ${results.sms.error || "failed"}`);
  return parts.join(". ") || "Done.";
}

export { CASE_FIELD_ROWS };

export { filterCaseFieldRows, shouldShowAdminOnlyCaseFields } from "./caseFieldVisibility";
