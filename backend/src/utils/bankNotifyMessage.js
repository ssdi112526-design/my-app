const { formatRepoRole } = require("./repoRoleLabels");
const { appendAdminFinancerMessageBody } = require("./adminFinancerNotifyFormat");

function safeValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return String(value).trim();
}

function getFullAddress(item) {
  const parts = [
    item.addressLine1,
    item.addressLine2,
    item.city,
    item.district,
    item.state,
    item.pincode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
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

/** Not included in WhatsApp / SMS / email or other shared messages. */
const MESSAGE_EXCLUDED_LABELS = new Set([
  "Loan Account Number",
  "Bank Name",
  "Branch Name",
  "Priority",
  "Repo Status",
  "Confirmation Status",
]);

/** @deprecated use MESSAGE_EXCLUDED_LABELS */
const BANK_NOTIFY_EXCLUDED_LABELS = MESSAGE_EXCLUDED_LABELS;

const BANK_NOTIFY_FIELD_ROWS = CASE_FIELD_ROWS.filter(
  (row) => !BANK_NOTIFY_EXCLUDED_LABELS.has(row.label)
);

function appendCaseFields(lines, caseDoc, rows = CASE_FIELD_ROWS) {
  rows.forEach(({ label, get }) => {
    const value = get(caseDoc);
    if (value) lines.push(`${label}: ${value}`);
  });
}

function appendTracedBySection(lines, tracedBy = {}) {
  if (!tracedBy?.name) return;
  lines.push("");
  lines.push("--- Traced by (field / team report) ---");
  lines.push(`Name: ${tracedBy.name}`);
  const roleLabel = tracedBy.roleLabel || formatRepoRole(tracedBy.role);
  if (roleLabel) lines.push(`Role: ${roleLabel}`);
  if (tracedBy.phone) lines.push(`Mobile: ${tracedBy.phone}`);
  if (tracedBy.note) lines.push(`Field note: ${tracedBy.note}`);
  if (tracedBy.at) {
    lines.push(`Reported at: ${new Date(tracedBy.at).toLocaleString()}`);
  }
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

const MESSAGE_FIELD_ROWS = CASE_FIELD_ROWS.filter(
  (row) => !MESSAGE_EXCLUDED_LABELS.has(row.label)
);

function buildTraceReportToAdminText(caseDoc, reporter = {}, extra = {}) {
  const lines = ["Vehicle Traced — Report to Admin", ""];
  appendCaseFields(lines, caseDoc, MESSAGE_FIELD_ROWS);
  appendTracedBySection(lines, {
    name: reporter.name,
    role: reporter.role,
    phone: reporter.phone,
    note: extra.requestNote || reporter.note,
    at: extra.reportedAt || new Date(),
  });
  return lines.join("\n");
}

/** External bank notify — financer Excel layout for admin (WhatsApp / SMS / email). */
function buildBankTracedNotifyText(caseDoc, context = {}) {
  const lines = [];
  appendBankNotifyIntro(lines, context);

  if (context.includeAdminBankerRef === false) {
    appendCaseFields(lines, caseDoc, BANK_NOTIFY_FIELD_ROWS);
  } else {
    appendAdminFinancerMessageBody(lines, caseDoc);
  }

  appendBankNotifyFooter(lines, context);
  return lines.join("\n");
}
function buildBankTracedSubject(caseDoc) {
  const registration = safeValue(caseDoc.vehicleNumber) || "—";
  return `Vehicle traced — confirmation required — ${registration}`;
}
function normalizePhoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}
function buildWhatsAppUrl(phone, text) {
  const digits = normalizePhoneDigits(phone);
  const waPhone = digits.length === 10 ? `91${digits}` : digits;
  const encoded = encodeURIComponent(text || "");
  return waPhone
    ? `https://wa.me/${waPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
module.exports = {
  buildTraceReportToAdminText,
  buildBankTracedNotifyText,
  buildBankTracedSubject,
  buildWhatsAppUrl,
};
