import { getFullAddress } from "../pages/repo/vehicles/findVehiclesHelpers";
import { formatVehicleNumberDisplay } from "./vehicleNumberUtils";
import { normalizeExcelHeader } from "./bankerExcelFields";
import { buildAdminExcelOrderedRows } from "./excelSheetDisplay";

export { normalizeExcelHeader };

function pickExcel(excelFields, aliases = []) {
  if (!excelFields || typeof excelFields !== "object") return "";
  const normAliases = aliases.map((a) => normalizeExcelHeader(a));
  for (const [key, val] of Object.entries(excelFields)) {
    const nk = normalizeExcelHeader(key);
    if (normAliases.includes(nk)) {
      const text = String(val).trim();
      if (text) return text;
    }
  }
  return "";
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "-") return s;
  }
  return "";
}

function formatUploadedOn(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function custAddress(caseData, excelFields) {
  const fromExcel = pickExcel(excelFields, [
    "cust address",
    "customer address",
    "address",
    "residence address",
  ]);
  if (fromExcel) return fromExcel;
  const parts = getFullAddress(caseData || {});
  return parts === "-" ? "" : parts;
}

function modelMake(caseData, excelFields) {
  const fromExcel = pickExcel(excelFields, [
    "model/make",
    "model make",
    "model",
    "make",
    "vehicle model",
    "vehicle brand",
  ]);
  if (fromExcel) return fromExcel;
  const parts = [caseData?.vehicleBrand, caseData?.vehicleModel].filter(Boolean);
  return parts.join(" / ");
}

function custContactNos(caseData, excelFields) {
  const fromExcel = pickExcel(excelFields, [
    "cust contact nos",
    "customer contact nos",
    "customer contact numbers",
    "contact nos",
  ]);
  if (fromExcel) return fromExcel;
  return [caseData?.mobileNumber, caseData?.alternateMobileNumber]
    .filter(Boolean)
    .join(", ");
}

/** LRMS mobile app field order (reference screenshots). */
const LRMS_FIELD_DEFS = [
  {
    label: "Vehicle No",
    get: (c, _conf, e) =>
      formatVehicleNumberDisplay(c?.vehicleNumber) ||
      pickExcel(e, ["vehicle no", "vehicle number", "registration number", "reg no"]),
  },
  {
    label: "Chassis No",
    get: (c, _conf, e) => firstNonEmpty(c?.chassisNumber, pickExcel(e, ["chassis no", "chasis no", "chassis number"])),
  },
  {
    label: "Model/Make",
    get: (c, _conf, e) => modelMake(c, e),
  },
  {
    label: "Engine No",
    get: (c, _conf, e) => firstNonEmpty(c?.engineNumber, pickExcel(e, ["engine no", "engine number"])),
  },
  {
    label: "Agreement No",
    get: (c, _conf, e) =>
      firstNonEmpty(
        c?.loanAccountNumber,
        pickExcel(e, [
          "loan number",
          "agreement no",
          "agreement number",
          "loan account number",
          "lan no",
        ])
      ),
  },
  {
    label: "Cust. Name",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.customerName, pickExcel(e, ["cust name", "customer name", "name", "borrower name"])),
  },
  {
    label: "Cust. Address",
    get: (c, _conf, e) => custAddress(c, e),
  },
  {
    label: "Bucket",
    get: (c, _conf, e) => firstNonEmpty(c?.bucket, pickExcel(e, ["bucket"])),
  },
  {
    label: "GV",
    get: (_c, _conf, e) => pickExcel(e, ["gv"]),
  },
  {
    label: "OD",
    get: (c, _conf, e) => {
      const od = pickExcel(e, ["od", "overdue", "due amount"]);
      if (od) return od;
      if (c?.dueAmount != null && c.dueAmount !== 0) return String(c.dueAmount);
      return "";
    },
  },
  {
    label: "Region",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.district, c?.state, pickExcel(e, ["region"])),
  },
  {
    label: "Area",
    get: (c, _conf, e) => firstNonEmpty(c?.city, pickExcel(e, ["area"])),
  },
  {
    label: "Branch (xlsx)",
    get: (c, _conf, e) =>
      firstNonEmpty(
        pickExcel(e, ["branch xlsx", "branch from file", "branch name"]),
        c?.branchName
      ),
  },
  {
    label: "Level 1",
    get: (_c, _conf, e) =>
      pickExcel(e, [
        "level 1",
        "1st confirmer",
        "first confirmer",
        "confirmation person 1",
        "confirmer 1",
      ]),
  },
  {
    label: "Level 2",
    get: (_c, _conf, e) =>
      pickExcel(e, ["level 2", "2nd confirmer", "second confirmer", "confirmation person 2"]),
  },
  {
    label: "Level 3",
    get: (_c, _conf, e) =>
      pickExcel(e, ["level 3", "3rd confirmer", "third confirmer", "confirmation person 3"]),
  },
  {
    label: "Level 4",
    get: (_c, _conf, e) => pickExcel(e, ["level 4", "4th confirmer", "fourth confirmer"]),
  },
  {
    label: "Finance",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.bankName, pickExcel(e, ["finance", "nbfc", "bank name", "financer"])),
  },
  {
    label: "Branch",
    get: (c, _conf, e) => firstNonEmpty(c?.branchName, pickExcel(e, ["branch"])),
  },
  {
    label: "Contact 1",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.mobileNumber, pickExcel(e, ["contact 1", "contact1", "mobile number", "phone"])),
  },
  {
    label: "Contact 2",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.alternateMobileNumber, pickExcel(e, ["contact 2", "contact2", "alternate mobile"])),
  },
  {
    label: "Contact 3",
    get: (_c, _conf, e) => pickExcel(e, ["contact 3", "contact3"]),
  },
  {
    label: "Sec9Available",
    get: (_c, _conf, e) =>
      pickExcel(e, ["sec9available", "sec 9 available", "section 9", "sec9", "section 9/17"]),
  },
  {
    label: "Sec17Available",
    get: (_c, _conf, e) =>
      pickExcel(e, ["sec17available", "sec 17 available", "section 17", "sec17", "section 17/9"]),
  },
  {
    label: "TBRFlag",
    get: (_c, _conf, e) => pickExcel(e, ["tbrflag", "tbr flag", "tbr"]),
  },
  {
    label: "Seasoning",
    get: (_c, _conf, e) => pickExcel(e, ["seasoning"]),
  },
  {
    label: "MailId 1",
    get: (_c, _conf, e) => pickExcel(e, ["mailid 1", "mail id 1", "email 1", "email"]),
  },
  {
    label: "MailId 2",
    get: (_c, _conf, e) => pickExcel(e, ["mailid 2", "mail id 2", "email 2"]),
  },
  {
    label: "Executive Name",
    get: (_c, _conf, e) => pickExcel(e, ["executive name", "executive"]),
  },
  {
    label: "POS",
    get: (c, _conf, e) => {
      const pos = pickExcel(e, ["pos"]);
      if (pos) return pos;
      if (c?.totalOutstandingAmount != null && c.totalOutstandingAmount !== 0) {
        return String(c.totalOutstandingAmount);
      }
      return "";
    },
  },
  {
    label: "TOSS",
    get: (_c, _conf, e) => pickExcel(e, ["toss"]),
  },
  {
    label: "Cust Contact Nos",
    get: (c, _conf, e) => custContactNos(c, e),
  },
  {
    label: "Remark",
    get: (c, _conf, e) =>
      firstNonEmpty(c?.fieldNotes, pickExcel(e, ["remark", "remarks", "field notes"])),
  },
  {
    label: "Uploaded On",
    get: (c) => formatUploadedOn(c?.createdAt),
  },
];

const ADMIN_ONLY_LRMS_LABELS = new Set([
  "Agreement No",
  "Finance",
  "Branch",
  "Branch (xlsx)",
]);

export function buildLrmsTraceDetailRows(caseData, confirmation = null, options = {}) {
  if (!caseData || typeof caseData !== "object") return [];

  const { isRepoAdmin = true } = options;

  if (isRepoAdmin) {
    return buildAdminExcelOrderedRows(caseData, { showEmpty: true });
  }

  const excelFields = caseData.excelFields || {};
  const rows = [];

  for (const def of LRMS_FIELD_DEFS) {
    if (!isRepoAdmin && ADMIN_ONLY_LRMS_LABELS.has(def.label)) continue;

    const raw = def.get(caseData, confirmation, excelFields);
    const value = raw == null ? "" : String(raw).trim();
    if (!value || value === "-") continue;
    rows.push({ label: def.label, value });
  }

  return rows;
}
