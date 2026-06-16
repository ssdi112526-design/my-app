/** Excel-friendly UTF-8 CSV (opens in Excel). */
function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const META_COLUMNS = [
  { key: "_vehicleQueryTyped", header: "Vehicle number (typed)" },
  { key: "_chassisQueryTyped", header: "Chassis number (typed)" },
  { key: "_searchBy", header: "Search by" },
  { key: "_searchQuery", header: "Active search query" },
];

const COLUMNS = [
  { key: "vehicleNumber", header: "Vehicle Number" },
  { key: "chassisNumber", header: "Chassis Number" },
  { key: "engineNumber", header: "Engine Number" },
  { key: "customerName", header: "Customer Name" },
  { key: "mobileNumber", header: "Mobile Number" },
  { key: "loanAccountNumber", header: "Loan Account" },
  { key: "bankName", header: "Bank" },
  { key: "branchName", header: "Branch" },
  { key: "city", header: "City" },
  { key: "state", header: "State" },
  { key: "caseCode", header: "Case Code" },
];

export function downloadFindVehiclesSearchCsv(
  rows,
  { searchMode, queryText, vehicleQueryTyped = "", chassisQueryTyped = "" } = {}
) {
  const searchByLabel =
    searchMode === "chassis" ? "Chassis number" : "Vehicle number";
  const allColumns = [...META_COLUMNS, ...COLUMNS];
  const headerLine = allColumns.map((c) => csvEscape(c.header)).join(",");
  const dataLines = (rows || []).map((row) => {
    const enriched = {
      ...row,
      _vehicleQueryTyped: vehicleQueryTyped ?? "",
      _chassisQueryTyped: chassisQueryTyped ?? "",
      _searchBy: searchByLabel,
      _searchQuery: queryText ?? "",
    };
    return allColumns.map((c) => csvEscape(enriched[c.key])).join(",");
  });
  const bom = "\ufeff";
  const csv = bom + [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const mode = searchMode === "chassis" ? "chassis" : "vehicle";
  const safeQ = String(queryText || "export")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 24);
  const filename = `find-vehicles-${mode}-${safeQ}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
