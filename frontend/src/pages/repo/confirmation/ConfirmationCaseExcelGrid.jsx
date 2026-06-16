import { useMemo } from "react";
import { CASE_FIELD_ROWS, filterCaseFieldRows } from "../../../utils/bankNotifyShare";
import { CONFIRMATION_VIEW_FIELD_ROWS } from "../../../constants/confirmationViewFields";
import { shouldShowAdminOnlyCaseFields } from "../../../utils/caseFieldVisibility";
import useAuth from "../../../hooks/useAuth";
import { useEnrichedAdminCase } from "../../../hooks/useEnrichedAdminCase";
import AdminExcelFieldGrid from "../../../components/repo/AdminExcelFieldGrid";
import { resolveConfirmationCaseId } from "./confirmationListUtils";

function cell(value) {
  const text = value == null || value === "" ? "—" : String(value);
  return text === "-" ? "—" : text;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export default function ConfirmationCaseExcelGrid({
  caseData,
  confirmation,
  companyName = "",
  adminUser = null,
  loading = false,
  hideTraceSummary = false,
  compactView = false,
}) {
  const { auth } = useAuth();
  const isRepoAdmin = shouldShowAdminOnlyCaseFields(auth?.user?.role);
  const caseId = resolveConfirmationCaseId(confirmation) || caseData?._id || caseData?.id;

  const { enrichedCase, enriching } = useEnrichedAdminCase(caseData, {
    token: auth?.token,
    caseId,
    enabled: isRepoAdmin && Boolean(caseData) && Boolean(auth?.token),
  });

  const fieldUserRows = useMemo(() => {
    const list = [];

    if (confirmation && !hideTraceSummary && !compactView) {
      list.push(
        { label: "Traced By", value: confirmation.requestedByName },
        { label: "Tracer Role", value: confirmation.requestedByRoleLabel || confirmation.requestedByRole },
        { label: "Reporter Mobile", value: confirmation.requestedByPhone },
        { label: "Field Note", value: confirmation.requestNote },
        { label: "Reported At", value: formatDate(confirmation.createdAt) },
        { label: "Confirmation Status", value: confirmation.status }
      );
    }

    if (companyName && !hideTraceSummary && !compactView) {
      list.push({ label: "Agency / Company", value: companyName });
    }

    if ((adminUser?.name || adminUser?.phone) && !hideTraceSummary && !compactView) {
      list.push(
        { label: "Admin Name", value: adminUser?.name },
        { label: "Admin Mobile", value: adminUser?.phone }
      );
    }

    if (caseData) {
      const baseRows = compactView ? CONFIRMATION_VIEW_FIELD_ROWS : CASE_FIELD_ROWS;
      const fieldRows = filterCaseFieldRows(baseRows, auth?.user?.role);
      fieldRows.forEach(({ label, get }) => {
        list.push({ label, value: get(caseData) });
      });
    }

    const mapped = list.map((row) => ({
      ...row,
      value: cell(row.value),
    }));

    if (compactView) {
      return mapped.filter((row) => row.value !== "—");
    }

    return mapped;
  }, [caseData, confirmation, companyName, adminUser, hideTraceSummary, compactView, auth?.user?.role]);

  if (isRepoAdmin && caseData) {
    return (
      <AdminExcelFieldGrid
        caseData={enrichedCase || caseData}
        loading={loading}
        enriching={enriching}
        layout="cards"
        className={compactView ? "cf-confirmation-summary" : undefined}
      />
    );
  }

  if (loading) {
    return <p className="cf-excel-loading">Loading case fields…</p>;
  }

  if (!fieldUserRows.length) {
    return <p className="cf-excel-loading">No case details available.</p>;
  }

  return (
    <div className={compactView ? "cf-confirmation-summary" : undefined}>
      <div className="cf-excel-mobile-stack">
        {fieldUserRows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="cf-excel-mobile-row">
            <span className="cf-excel-mobile-row__label">{row.label}</span>
            <span className="cf-excel-mobile-row__value">{row.value}</span>
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
            {fieldUserRows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td className="cf-excel-field">{row.label}</td>
                <td className="cf-excel-value">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
