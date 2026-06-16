import { useMemo } from "react";
import { buildAdminExcelOrderedRows } from "../../utils/excelSheetDisplay";
import { formatVehicleNumberDisplay } from "../../utils/vehicleNumberUtils";

function displayValue(label, value) {
  let text = value == null || value === "" ? "—" : String(value);
  if (text === "—") return "—";
  const nk = String(label).toLowerCase();
  if (
    text === "0" &&
    (nk.includes("engine") || nk.includes("chasis") || nk.includes("chassis"))
  ) {
    return "—";
  }
  if (label === "instalment" && !text) return "1";
  if (nk.includes("registration") || nk.includes("vehicle no")) {
    const formatted = formatVehicleNumberDisplay(text);
    return formatted !== "—" ? formatted : text;
  }
  return text;
}

/**
 * All uploaded Excel columns (repo admin).
 * layout="cards" — Find Vehicles style grid (label on top, value below).
 * layout="list" — confirmation list rows with colon separator.
 */
export default function AdminExcelFieldGrid({
  caseData,
  loading = false,
  enriching = false,
  layout = "cards",
  className = "",
  emptyMessage = "No Excel details available for this vehicle.",
}) {
  const rows = useMemo(() => {
    if (!caseData) return [];
    return buildAdminExcelOrderedRows(caseData, { showEmpty: true });
  }, [caseData]);

  if (loading || enriching) {
    return <p className="cf-excel-loading">Loading full Excel sheet…</p>;
  }

  if (!rows.length) {
    return <p className="cf-excel-loading">{emptyMessage}</p>;
  }

  if (layout === "cards") {
    return (
      <div className={`fv-detail-grid${className ? ` ${className}` : ""}`}>
        {rows.map((row, index) => (
          <div
            className={`fv-detail-item${
              String(row.label).toLowerCase().includes("address") ? " fv-detail-item--full" : ""
            }`}
            key={`${row.label}-${index}`}
          >
            <span className="fv-detail-label">{row.label}</span>
            <span className="fv-detail-value">{displayValue(row.label, row.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className || undefined}>
      <div className="lrms-trace-list" role="list">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="lrms-trace-row"
            role="listitem"
          >
            <span className="lrms-trace-row__label">{row.label}</span>
            <span className="lrms-trace-row__sep">:</span>
            <span className="lrms-trace-row__value">
              {displayValue(row.label, row.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="company-table-wrap cf-excel-sheet cf-excel-sheet--desktop">
        <table className="users-table excel-grid-table cf-excel-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td className="cf-excel-field">{row.label}</td>
                <td className="cf-excel-value">{displayValue(row.label, row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
