import { formatVehicleNumberDisplay, normalizeVehicleNumber } from "./vehicleNumberUtils";
import { normalizeExcelHeader } from "./bankerExcelFields";
import {
  extractBankerContactsFromColumns,
  formatBankerAwareExcelCell,
} from "./bankerExcelExtract";

const VEHICLE_KEY_RE = /veh|reg|rc|vrn|plate|registration/i;

const CORE_EXTRA_PATTERNS = {
  vehicleNumber: [/vehicle/i, /reg/i, /rc\s*no/i, /registration/i, /vrn/i, /plate/i],
  borrowerName: [/customer\s*name/i, /borrower/i, /applicant/i, /^name$/i, /customer/i, /debtor/i],
  borrowerPhone: [/customer\s*mobile/i, /borrower\s*mobile/i, /mobile/i, /phone/i, /contact/i],
  loanAccountNumber: [/loan\s*number/i, /loan\s*no/i, /loan\s*account/i, /agreement/i, /lan/i, /lad/i],
  chassisNumber: [/chasis/i, /chassis/i, /vin/i, /frame/i],
  engineNumber: [/engine/i],
  borrowerAddress: [/address/i, /location/i, /residence/i],
  outstandingAmount: [/outstanding/i, /overdue/i, /os\s*amt/i, /^pos$/i],
  loanAmount: [/loan\s*amt/i, /principal/i, /disbursed/i],
  vehicleMake: [/^make$/i, /brand/i, /manufacturer/i],
  vehicleModel: [/model/i, /^type$/i],
  vehicleYear: [/year/i, /mfg/i, /manufacturing/i],
  branchName: [/branch/i],
  branchCode: [/branch\s*code/i],
};

function isPlaceholder(val) {
  const t = String(val ?? "")
    .trim()
    .toUpperCase();
  return !t || t === "NA" || t === "N/A" || t === "NULL" || t === "-" || t === "—";
}

function isBankerColumn(label) {
  return /bankar|banker/i.test(String(label || ""));
}

export function resolveVehicleNumber(record) {
  const direct = record?.vehicleNumber;
  if (!isPlaceholder(direct)) {
    return normalizeVehicleNumber(direct) || String(direct).trim().toUpperCase();
  }
  return normalizeVehicleNumber(coalesceCoreField(record, "vehicleNumber")) || "";
}

export function displayVehicleNumber(record) {
  const raw = resolveVehicleNumber(record);
  if (!raw) return "—";
  const formatted = formatVehicleNumberDisplay(raw);
  return formatted !== "—" ? formatted : raw;
}

export function formatBankMoney(value) {
  if (value == null || value === "") return "—";
  const n = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Read core field from DB or matching Excel column (for older imports). */
export function coalesceCoreField(record, fieldKey) {
  const direct = record?.[fieldKey];
  if (!isPlaceholder(direct)) {
    if (fieldKey === "outstandingAmount" || fieldKey === "loanAmount") {
      const n = Number(String(direct).replace(/,/g, ""));
      return Number.isNaN(n) ? String(direct).trim() : n;
    }
    return String(direct).trim();
  }

  const patterns = CORE_EXTRA_PATTERNS[fieldKey];
  if (!patterns) return "";

  const extra = record?.extraFields;
  if (!extra || typeof extra !== "object") return "";

  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    if (fieldKey === "borrowerPhone" && isBankerColumn(key)) continue;
    if (fieldKey === "borrowerName" && (isBankerColumn(key) || /mobile|phone/i.test(key))) continue;
    if (patterns.some((re) => re.test(key)) && !isPlaceholder(val)) {
      return String(val).trim();
    }
  }
  return "";
}

export function formatCoreFieldDisplay(record, fieldKey) {
  const val = coalesceCoreField(record, fieldKey);
  if (val === "" || val === null || val === undefined) return "—";
  if (fieldKey === "outstandingAmount" || fieldKey === "loanAmount") {
    return formatBankMoney(val);
  }
  if (fieldKey === "vehicleNumber") {
    return displayVehicleNumber(record);
  }
  return String(val);
}

function formatExcelCell(label, value) {
  if (isPlaceholder(value)) return "—";
  const text = String(value).trim();
  if (VEHICLE_KEY_RE.test(label)) {
    const formatted = formatVehicleNumberDisplay(text);
    return formatted !== "—" ? formatted : text;
  }
  return formatBankerAwareExcelCell(label, value);
}

function isVehicleExtraKey(label) {
  return VEHICLE_KEY_RE.test(String(label || ""));
}

function displayLabelForExcelColumn(label, storageKey, labelCounts) {
  const count = labelCounts[label] || 0;
  if (count > 1 && storageKey !== label && /_\d+$/.test(storageKey)) {
    const suffix = storageKey.slice(label.length + 1);
    return `${label} (${suffix})`;
  }
  return label;
}

/** Column pairs in upload order (storage key + header label). */
export function getExcelColumnPairs(record) {
  const extra = record?.extraFields;
  if (!extra || typeof extra !== "object") return [];

  const labels = Array.isArray(extra._excelColumnOrder) ? extra._excelColumnOrder : [];
  const columnKeys = Array.isArray(extra._excelColumnKeys) ? extra._excelColumnKeys : [];

  if (columnKeys.length) {
    return columnKeys
      .map((storageKey, i) => ({
        storageKey: String(storageKey || "").trim(),
        label: String(labels[i] || storageKey || "").trim(),
      }))
      .filter(({ storageKey }) => storageKey && !storageKey.startsWith("_"));
  }
  if (labels.length) {
    return labels
      .map((label) => ({ storageKey: String(label).trim(), label: String(label).trim() }))
      .filter(({ storageKey }) => storageKey && !storageKey.startsWith("_"));
  }
  return Object.keys(extra)
    .filter((k) => !String(k).startsWith("_"))
    .map((storageKey) => ({ storageKey, label: storageKey }));
}

/** Raw cell value from extraFields (any key casing / storage key). */
export function getRawExtraCellValue(extra, storageKey, label) {
  if (!extra || typeof extra !== "object") return "";
  const candidates = [storageKey, label].filter(Boolean);
  for (const c of candidates) {
    if (extra[c] != null && extra[c] !== "") {
      const s = String(extra[c]).trim();
      if (s) return s;
    }
  }
  const want = new Set(candidates.map((c) => normalizeExcelHeader(c)));
  for (const [key, val] of Object.entries(extra)) {
    if (String(key).startsWith("_")) continue;
    if (want.has(normalizeExcelHeader(key))) {
      const s = String(val ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

/** Every column from the uploaded Excel (original order when available). */
export function allExcelColumnsForDisplay(record) {
  const extra = record?.extraFields;
  if (!extra || typeof extra !== "object") return [];

  const pairs = getExcelColumnPairs(record);
  const labels = Array.isArray(extra._excelColumnOrder) ? extra._excelColumnOrder : [];
  const labelCounts = {};
  for (const label of labels) {
    if (label) labelCounts[label] = (labelCounts[label] || 0) + 1;
  }

  return pairs
    .filter(({ storageKey }) => storageKey && !String(storageKey).startsWith("_"))
    .map(({ storageKey, label }) => {
      const displayLabel = displayLabelForExcelColumn(label, storageKey, labelCounts);
      let value = extra[storageKey];
      if (value === undefined && storageKey !== label) {
        value = extra[label];
      }
      if (isPlaceholder(value)) {
        for (const [coreKey, patterns] of Object.entries(CORE_EXTRA_PATTERNS)) {
          if (patterns.some((re) => re.test(label))) {
            const fromCore = coalesceCoreField(record, coreKey);
            if (!isPlaceholder(fromCore)) {
              value = fromCore;
              break;
            }
          }
        }
      }
      const rawText = String(value ?? "").trim();
      return {
        label: displayLabel,
        storageKey,
        sourceLabel: label,
        rawValue: isPlaceholder(rawText) ? "" : rawText,
        value: formatExcelCell(label, value),
      };
    });
}

/** @deprecated Use allExcelColumnsForDisplay */
export function extraFieldEntries(record) {
  return allExcelColumnsForDisplay(record).filter(({ value }) => value !== "—");
}

/** Read 1st/2nd/3rd banker from stored Excel columns (same source as "All columns" section). */
export function extractBankerFieldsFromRecord(record) {
  const contacts = extractBankerContactsFromColumns(allExcelColumnsForDisplay(record || {}));
  const byKey = Object.fromEntries(contacts.map((c) => [c.key, c.value]));
  return {
    banker1Name: byKey.banker1Name || "",
    banker1Phone: byKey.banker1Phone || "",
    banker2Name: byKey.banker2Name || "",
    banker2Phone: byKey.banker2Phone || "",
    banker3Name: byKey.banker3Name || "",
    banker3Phone: byKey.banker3Phone || "",
  };
}
