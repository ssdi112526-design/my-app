const xlsx = require("xlsx");
const {
  isLoanAccountValue,
  isBankerMobileValue,
  isLoanColumnKey,
} = require("../../utils/bankerValueUtils");

const normalizeHeader = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const upperValue = (value) => cleanValue(value).toUpperCase();

const numberLikeString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\.0$/, "").trim();
};

const HEADER_ALIASES = {
  vehicleNumber: [
    "vehicle number",
    "vehicle no",
    "registration number",
    "registration numbers",
    "registration no",
    "reg no",
    "reg number",
    "rc number",
    "registration",
  ],
  customerName: [
    "customer name",
    "customer",
    "name",
    "applicant name",
    "borrower name",
  ],
  mobileNumber: [
    "mobile number",
    "mobile no",
    "phone",
    "phone number",
    "customer mobile",
    "customer mobile number",
    "cust mobile",
    "cust mobile no",
    "customer contact number",
    "customer contact no",
    "cust contact nos",
    "cust contact no",
    "registered mobile",
    "borrower mobile",
  ],
  alternateMobileNumber: [
    "alternate mobile number",
    "alternate mobile no",
  ],
  loanAccountNumber: [
    "loan account number",
    "loan number",
    "loan no",
    "loan a c no",
    "loan ac no",
    "lan no",
    "lan number",
    "agreement number",
    "agreement no",
  ],
  referenceNumber: ["reference number", "reference no", "ref number", "ref no"],
  vehicleBrand: ["make", "brand", "vehicle brand"],
  vehicleModel: ["model", "vehicle model"],
  chassisNumber: ["chassis number", "chasis number", "chassis no", "chasis no"],
  engineNumber: ["engine number", "engine no"],
  emiAmount: ["emi", "emi amount"],
  dueAmount: ["due amount", "due"],
  totalOutstandingAmount: [
    "pos",
    "outstanding",
    "outstanding amount",
    "total outstanding amount",
  ],
  addressLine1: [
    "address",
    "address line 1",
    "customer address",
    "residence address",
    "full address",
  ],
  city: ["city"],
  state: ["state"],
  branchNameFromFile: ["branch", "branch name"],
  bucket: ["bucket"],
  contactPerson1Name: [
    "1st bankar name",
    "1st banker name",
    "first bankar name",
    "first banker name",
    "1st banker",
    "first banker",
    "banker 1 name",
    "banker name 1",
    "banker1 name",
    "contact person 1 name",
    "contact person 1",
    "contact person1 name",
    "level 1",
    "1st confirmer",
    "first confirmer",
    "confirmation person 1",
    "confirmer 1 name",
    "confirmation name 1",
    "confirmation 1 name",
    "confirmation name1",
    "confirmer 1",
  ],
  contactPerson1Phone: [
    "banker 1 number",
    "banker1 number",
    "banker 1 no",
    "banker1 no",
    "banker 1 mobile",
    "banker 1 phone",
    "banker 1 contact",
    "1st banker number",
    "first banker number",
    "1st mobile no",
    "mobile no 1",
    "mobile no_1",
    "1st contact number",
    "first contact number",
    "1st banker contact",
    "first banker contact",
    "1st banker contact number",
    "1st banker mobile",
    "1st banker phone",
    "1st banker no",
    "banker 1 contact",
    "banker 1 mobile",
    "banker 1 phone",
    "contact person 1 number",
    "contact person 1 mobile",
    "contact person 1 phone",
    "contact person 1 no",
    "contact person1 number",
    "1st confirmer no",
    "1st confirmer number",
    "first confirmer no",
    "first confirmer number",
    "contact 1",
    "contact 1 number",
    "contact1",
    "confirmation number 1",
    "confirmation no 1",
    "confirmation 1 number",
    "confirmation 1 no",
    "confirmation number1",
    "confirmer 1 number",
    "confirmer 1 no",
  ],
  contactPerson2Name: [
    "2nd bankar name",
    "2nd banker name",
    "second bankar name",
    "second banker name",
    "2nd banker",
    "contact person 2 name",
    "contact person 2",
    "contact person2 name",
    "level 2",
    "2nd confirmer",
    "second confirmer",
    "confirmation person 2",
    "confirmer 2 name",
    "confirmation name 2",
    "confirmation 2 name",
    "confirmation name2",
    "confirmer 2",
  ],
  contactPerson2Phone: [
    "banker 2 number",
    "banker2 number",
    "banker 2 no",
    "banker2 no",
    "banker 2 mobile",
    "banker 2 phone",
    "2nd banker number",
    "second banker number",
    "2nd mobile no",
    "mobile no 2",
    "mobile no_2",
    "2nd contact number",
    "second contact number",
    "contact person 2 number",
    "contact person 2 mobile",
    "contact person 2 phone",
    "contact person 2 no",
    "contact person2 number",
    "2nd confirmer no",
    "2nd confirmer number",
    "second confirmer no",
    "contact 2",
    "contact 2 number",
    "contact2",
    "confirmation number 2",
    "confirmation no 2",
    "confirmation 2 number",
    "confirmation 2 no",
    "confirmation number2",
    "confirmer 2 number",
    "confirmer 2 no",
  ],
  contactPerson3Name: [
    "3rd bankar name",
    "3rd banker name",
    "third bankar name",
    "third banker name",
    "3rd banker",
    "third banker",
    "contact person 3 name",
    "contact person 3",
    "3rd confirmer",
    "third confirmer",
  ],
  contactPerson3Phone: [
    "banker 3 number",
    "banker3 number",
    "banker 3 no",
    "banker3 no",
    "banker 3 mobile",
    "banker 3 phone",
    "3rd banker number",
    "third banker number",
    "3rd mobile no",
    "mobile no 3",
    "mobile no_3",
    "3rd contact number",
    "third contact number",
    "contact person 3 number",
    "contact person 3 mobile",
    "contact person 3 phone",
    "contact person 3 no",
    "3rd confirmer no",
    "third confirmer no",
    "contact 3",
    "contact 3 number",
  ],
  bankNotifyEmail1: [
    "mailid 1",
    "mail id 1",
    "email 1",
    "bank email",
    "bank email 1",
    "authority email",
    "email",
  ],
  bankNotifyEmail2: ["mailid 2", "mail id 2", "email 2", "bank email 2"],
};

const SYSTEM_FIELD_DEFS = [
  { key: "customerName", label: "Customer Name", required: true },
  { key: "mobileNumber", label: "Mobile Number", required: false },
  { key: "loanAccountNumber", label: "Loan Account Number", required: false },
  { key: "vehicleNumber", label: "Vehicle Number", required: false },
  { key: "addressLine1", label: "Address", required: false },
  { key: "city", label: "City", required: false },
  { key: "state", label: "State", required: false },
  { key: "alternateMobileNumber", label: "Alternate Mobile", required: false },
  { key: "referenceNumber", label: "Reference Number", required: false },
  { key: "chassisNumber", label: "Chassis Number", required: false },
  { key: "engineNumber", label: "Engine Number", required: false },
  { key: "vehicleBrand", label: "Vehicle Brand", required: false },
  { key: "vehicleModel", label: "Vehicle Model", required: false },
  { key: "emiAmount", label: "EMI Amount", required: false },
  { key: "dueAmount", label: "Due Amount", required: false },
  { key: "totalOutstandingAmount", label: "Outstanding Amount", required: false },
  { key: "bucket", label: "Bucket", required: false },
  { key: "branchNameFromFile", label: "Branch (from file)", required: false },
];

const findColumnKey = (row, aliases = []) => {
  const keys = Object.keys(row || {});
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (aliases.includes(normalizedKey)) {
      return key;
    }
  }
  return null;
};

const getValueByAliases = (row, aliases = [], transformer = cleanValue) => {
  const key = findColumnKey(row, aliases);
  if (!key) return "";
  return transformer(row[key]);
};

const getValueByMapping = (row, columnName, transformer = cleanValue) => {
  if (!columnName || !row || !(columnName in row)) return "";
  return transformer(row[columnName]);
};

/** Loan id only from Loan Number / LAN / Agreement columns (not generic 10-digit cells). */
const extractLoanAccountFromRow = (row, columnMapping = null) => {
  if (!row || typeof row !== "object") return "";

  if (columnMapping?.loanAccountNumber && row[columnMapping.loanAccountNumber] != null) {
    const mapped = numberLikeString(row[columnMapping.loanAccountNumber]);
    if (isLoanAccountValue(mapped)) return mapped;
  }

  for (const key of Object.keys(row)) {
    const nk = normalizeHeader(key);
    if (!isLoanColumnKey(nk)) continue;
    const val = numberLikeString(row[key]);
    if (isLoanAccountValue(val)) return val;
  }

  return "";
};

const sanitizeBankerPhoneValue = (value) => {
  const v = numberLikeString(value);
  return isBankerMobileValue(v) ? v : "";
};

const getFieldValue = (row, fieldKey, columnMapping = null) => {
  const aliases = HEADER_ALIASES[fieldKey] || [];
  let transformer = cleanValue;

  if (fieldKey === "vehicleNumber" || fieldKey === "chassisNumber" || fieldKey === "engineNumber") {
    transformer = upperValue;
  } else if (
    fieldKey === "mobileNumber" ||
    fieldKey === "alternateMobileNumber" ||
    fieldKey === "loanAccountNumber" ||
    fieldKey === "referenceNumber" ||
    fieldKey === "contactPerson1Phone" ||
    fieldKey === "contactPerson2Phone" ||
    fieldKey === "contactPerson3Phone"
  ) {
    transformer = numberLikeString;
  }

  if (columnMapping && columnMapping[fieldKey]) {
    return getValueByMapping(row, columnMapping[fieldKey], transformer);
  }

  return getValueByAliases(row, aliases, transformer);
};

const normalizeRow = (row, selectedBranchName = "", columnMapping = null) => {
  const customerName = getFieldValue(row, "customerName", columnMapping);
  const mobileNumber = getFieldValue(row, "mobileNumber", columnMapping);
  const alternateMobileNumber = getFieldValue(row, "alternateMobileNumber", columnMapping);
  const loanAccountNumber = extractLoanAccountFromRow(row, columnMapping);
  const referenceNumber = getFieldValue(row, "referenceNumber", columnMapping);
  const vehicleNumber = getFieldValue(row, "vehicleNumber", columnMapping);
  const chassisNumber = getFieldValue(row, "chassisNumber", columnMapping);
  const engineNumber = getFieldValue(row, "engineNumber", columnMapping);
  const vehicleBrand = getFieldValue(row, "vehicleBrand", columnMapping);
  const vehicleModel = getFieldValue(row, "vehicleModel", columnMapping);
  const emiAmountRaw = getFieldValue(row, "emiAmount", columnMapping);
  const dueAmountRaw = getFieldValue(row, "dueAmount", columnMapping);
  const totalOutstandingAmountRaw = getFieldValue(
    row,
    "totalOutstandingAmount",
    columnMapping
  );
  const addressLine1 = getFieldValue(row, "addressLine1", columnMapping);
  const city = getFieldValue(row, "city", columnMapping);
  const state = getFieldValue(row, "state", columnMapping);
  const branchNameFromFile = getFieldValue(row, "branchNameFromFile", columnMapping);
  const bucket = getFieldValue(row, "bucket", columnMapping);
  const contactPerson1Name = getFieldValue(row, "contactPerson1Name", columnMapping);
  const contactPerson1Phone = sanitizeBankerPhoneValue(
    getFieldValue(row, "contactPerson1Phone", columnMapping)
  );
  const contactPerson2Name = getFieldValue(row, "contactPerson2Name", columnMapping);
  const contactPerson2Phone = sanitizeBankerPhoneValue(
    getFieldValue(row, "contactPerson2Phone", columnMapping)
  );
  const contactPerson3Name = getFieldValue(row, "contactPerson3Name", columnMapping);
  const contactPerson3Phone = sanitizeBankerPhoneValue(
    getFieldValue(row, "contactPerson3Phone", columnMapping)
  );
  const bankNotifyEmail1 = getFieldValue(row, "bankNotifyEmail1", columnMapping);
  const bankNotifyEmail2 = getFieldValue(row, "bankNotifyEmail2", columnMapping);

  const emiAmount = emiAmountRaw ? Number(String(emiAmountRaw).replace(/,/g, "")) : 0;
  const dueAmount = dueAmountRaw ? Number(String(dueAmountRaw).replace(/,/g, "")) : 0;
  const totalOutstandingAmount = totalOutstandingAmountRaw
    ? Number(String(totalOutstandingAmountRaw).replace(/,/g, ""))
    : 0;

  return {
    customerName,
    mobileNumber,
    alternateMobileNumber,
    loanAccountNumber,
    referenceNumber,
    vehicleNumber,
    chassisNumber,
    engineNumber,
    vehicleBrand,
    vehicleModel,
    addressLine1,
    city,
    state,
    emiAmount: Number.isNaN(emiAmount) ? 0 : emiAmount,
    dueAmount: Number.isNaN(dueAmount) ? 0 : dueAmount,
    totalOutstandingAmount: Number.isNaN(totalOutstandingAmount) ? 0 : totalOutstandingAmount,
    bucket,
    branchNameFromFile,
    branchName: selectedBranchName || branchNameFromFile || "",
    contactPerson1Name,
    contactPerson1Phone,
    contactPerson2Name,
    contactPerson2Phone,
    contactPerson3Name,
    contactPerson3Phone,
    bankNotifyEmail1,
    bankNotifyEmail2,
  };
};

const READ_OPTS = {
  type: "buffer",
  cellStyles: false,
  cellDates: false,
  cellNF: false,
  cellHTML: false,
};

const readWorkbook = (buffer) => {
  const workbook = xlsx.read(buffer, READ_OPTS);

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel file has no sheets.");
  }

  return workbook;
};

/** Fast verify: reads sheet range for row count; only converts first ~25 rows to JSON. */
const parseWorkbookPreview = (buffer) => {
  const workbook = readWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet || !worksheet["!ref"]) {
    throw new Error("Excel sheet is empty.");
  }

  const fullRange = xlsx.utils.decode_range(worksheet["!ref"]);
  const totalRows = Math.max(0, fullRange.e.r - fullRange.s.r);

  const previewEndRow = Math.min(fullRange.e.r, fullRange.s.r + 25);
  const previewRange = xlsx.utils.encode_range({
    s: { r: fullRange.s.r, c: fullRange.s.c },
    e: { r: previewEndRow, c: fullRange.e.c },
  });

  const previewRowsRaw = xlsx.utils.sheet_to_json(worksheet, {
    range: previewRange,
    defval: "",
    raw: false,
  });

  if (!previewRowsRaw.length) {
    throw new Error("Excel sheet has no data rows.");
  }

  const columns = Object.keys(previewRowsRaw[0] || {}).filter(Boolean);
  const suggestedMapping = buildSuggestedMapping(previewRowsRaw[0]);

  return {
    rows: previewRowsRaw,
    columns,
    sheetName,
    totalRows,
    suggestedMapping,
  };
};

/** Read header row cell-by-cell so duplicate titles (e.g. two "mobile no") stay separate. */
function readWorksheetHeaderColumns(worksheet) {
  const range = xlsx.utils.decode_range(worksheet["!ref"]);
  const headerRow = range.s.r;
  const headers = [];
  const normOccurrence = {};

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = xlsx.utils.encode_cell({ r: headerRow, c });
    const cell = worksheet[addr];
    if (!cell) continue;
    const label = cleanValue(cell.w ?? cell.v);
    if (!label) continue;
    const norm = normalizeHeader(label);
    const n = (normOccurrence[norm] || 0) + 1;
    normOccurrence[norm] = n;
    headers.push({
      label,
      storageKey: n > 1 ? `${label}_${n}` : label,
      col: c,
    });
  }

  return { headers, headerRow, range };
}

function cleanCellValue(cell) {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") {
    return cleanValue(cell.w);
  }
  if (cell.v == null) return "";
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    if (cell.v >= 1e9 && cell.v < 1e11) return String(Math.round(cell.v));
    return numberLikeString(cell.v);
  }
  return cleanValue(cell.v);
}

function worksheetRowToObject(worksheet, headers, rowIndex) {
  const row = {};
  let hasData = false;
  for (const h of headers) {
    const addr = xlsx.utils.encode_cell({ r: rowIndex, c: h.col });
    const cell = worksheet[addr];
    const val = cleanCellValue(cell);
    if (val) hasData = true;
    row[h.storageKey] = val;
  }
  return { row, hasData };
}

function parseWorksheetDataRows(worksheet) {
  const { headers, headerRow, range } = readWorksheetHeaderColumns(worksheet);
  if (!headers.length) {
    throw new Error("Excel sheet has no column headers.");
  }

  const rows = [];
  const columnOrder = headers.map((h) => h.label);
  const columnKeys = headers.map((h) => h.storageKey);

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const { row, hasData } = worksheetRowToObject(worksheet, headers, r);
    if (!hasData) continue;
    row._excelColumnOrder = columnOrder;
    row._excelColumnKeys = columnKeys;
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("Excel sheet has no data rows.");
  }

  const columns = headers.map((h) => h.label);
  return { rows, columns, headers };
}

const parseWorkbookRows = (buffer) => {
  const workbook = readWorkbook(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet || !worksheet["!ref"]) {
    throw new Error("Excel sheet is empty.");
  }

  const { rows, columns } = parseWorksheetDataRows(worksheet);
  return { rows, columns, sheetName };
};

/** Row count without loading all rows into memory. */
const countWorkbookDataRows = (buffer) => {
  const workbook = readWorkbook(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet || !worksheet["!ref"]) {
    throw new Error("Excel sheet is empty.");
  }
  const fullRange = xlsx.utils.decode_range(worksheet["!ref"]);
  return {
    totalRows: Math.max(0, fullRange.e.r - fullRange.s.r),
    sheetName: workbook.SheetNames[0],
    worksheet,
    fullRange,
  };
};

/**
 * Process Excel in chunks (lower memory than loading all rows at once).
 * Each chunk is an array of row objects.
 */
function* iterateWorkbookRowChunks(worksheet, fullRange, chunkSize = 2000) {
  const { headers, headerRow } = readWorksheetHeaderColumns(worksheet);
  const lastRow = fullRange.e.r;

  for (let start = headerRow + 1; start <= lastRow; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, lastRow);
    const rows = [];
    for (let r = start; r <= end; r++) {
      const { row, hasData } = worksheetRowToObject(worksheet, headers, r);
      if (hasData) rows.push(row);
    }
    if (rows.length > 0) {
      yield { rows, startIndex: start - headerRow - 1 };
    }
  }
}

const buildSuggestedMapping = (firstRow = {}) => {
  const mapping = {};

  for (const field of Object.keys(HEADER_ALIASES)) {
    const key = findColumnKey(firstRow, HEADER_ALIASES[field]);
    if (key) {
      mapping[field] = key;
    }
  }

  return mapping;
};

const parseColumnMappingBody = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Snapshot Excel row — preserves upload column order; duplicate headers get unique keys. */
const buildExcelFieldsSnapshot = (rawRow = {}) => {
  if (
    rawRow &&
    typeof rawRow === "object" &&
    Array.isArray(rawRow._excelColumnOrder) &&
    rawRow._excelColumnOrder.length
  ) {
    const snapshot = {};
    for (const [col, val] of Object.entries(rawRow)) {
      if (String(col).startsWith("_")) continue;
      snapshot[col] = cleanValue(val);
    }
    snapshot._excelColumnOrder = [...rawRow._excelColumnOrder];
    snapshot._excelColumnKeys = [...(rawRow._excelColumnKeys || [])];
    return snapshot;
  }

  const snapshot = {};
  const columnOrder = [];
  const columnKeys = [];
  const normOccurrence = {};

  for (const [col, val] of Object.entries(rawRow)) {
    const original = String(col).trim();
    if (!original || original.startsWith("_")) continue;
    const norm = normalizeHeader(original);
    const n = (normOccurrence[norm] || 0) + 1;
    normOccurrence[norm] = n;

    const storageKey = n > 1 ? `${original}_${n}` : original;
    columnOrder.push(original);
    columnKeys.push(storageKey);
    const cleaned = cleanValue(val);
    snapshot[storageKey] = cleaned;
    if (cleaned && n === 1 && norm && !snapshot[norm]) {
      snapshot[norm] = cleaned;
    }
  }
  if (columnOrder.length) {
    snapshot._excelColumnOrder = columnOrder;
    snapshot._excelColumnKeys = columnKeys;
  }
  return snapshot;
};

/** Walk columns in Excel file order (supports duplicate headers like two "mobile no"). */
const listExcelColumnsInFileOrder = (excelFields = {}) => {
  if (!excelFields || typeof excelFields !== "object") return [];
  const order = excelFields._excelColumnOrder;
  const keys = excelFields._excelColumnKeys;

  if (Array.isArray(order) && Array.isArray(keys) && keys.length === order.length) {
    const cols = [];
    for (let i = 0; i < order.length; i++) {
      const label = String(order[i] || "").trim();
      const key = String(keys[i] || "").trim();
      if (!label || key.startsWith("_")) continue;
      cols.push({
        key,
        label,
        nk: normalizeHeader(label),
        value: String(excelFields[key] ?? "").trim(),
      });
    }
    return cols;
  }

  if (Array.isArray(order) && order.length) {
    const occ = {};
    const cols = [];
    for (const label of order) {
      if (!label || String(label).startsWith("_")) continue;
      const nk = normalizeHeader(label);
      occ[nk] = (occ[nk] || 0) + 1;
      const storageKey = occ[nk] === 1 ? label : `${label}_${occ[nk]}`;
      cols.push({
        key: storageKey,
        label,
        nk,
        value: String(excelFields[storageKey] ?? (occ[nk] === 1 ? excelFields[label] : "") ?? "").trim(),
      });
    }
    return cols;
  }

  const cols = [];
  for (const [key, val] of Object.entries(excelFields)) {
    if (String(key).startsWith("_")) continue;
    const value = String(val ?? "").trim();
    cols.push({ key, label: key, nk: normalizeHeader(key), value });
  }
  return cols;
};

module.exports = {
  cleanValue,
  normalizeHeader,
  extractLoanAccountFromRow,
  normalizeRow,
  readWorkbook,
  readWorksheetHeaderColumns,
  parseWorkbookPreview,
  parseWorkbookRows,
  countWorkbookDataRows,
  iterateWorkbookRowChunks,
  buildSuggestedMapping,
  parseColumnMappingBody,
  buildExcelFieldsSnapshot,
  listExcelColumnsInFileOrder,
  SYSTEM_FIELD_DEFS,
  HEADER_ALIASES,
};
