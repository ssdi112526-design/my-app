import useAuth from "../../../hooks/useAuth";
import { shouldShowAdminOnlyCaseFields } from "../../../utils/caseFieldVisibility";
import { useEnrichedAdminCase } from "../../../hooks/useEnrichedAdminCase";
import AdminExcelFieldGrid from "../../../components/repo/AdminExcelFieldGrid";
import { buildLrmsTraceDetailRows } from "../../../utils/lrmsTraceDetailFields";
import { resolveConfirmationCaseId } from "./confirmationListUtils";

const PHONE_SPLIT_RE = /(\+?\d[\d\s-]{8,14}\d)/g;
const PHONE_ONLY_RE = /^\+?\d[\d\s-]{8,14}\d$/;

function highlightPhones(text) {
  const str = String(text);
  const parts = str.split(PHONE_SPLIT_RE);
  if (parts.length === 1) return str;

  return parts.map((part, index) => {
    const trimmed = part.trim();
    if (trimmed && PHONE_ONLY_RE.test(trimmed)) {
      return (
        <span key={`${index}-${part}`} className="lrms-trace-phone">
          {trimmed}
        </span>
      );
    }
    return part;
  });
}

export default function LrmsTraceDetailList({
  caseData,
  confirmation = null,
  loading = false,
}) {
  const { auth } = useAuth();
  const isRepoAdmin = shouldShowAdminOnlyCaseFields(auth?.user?.role);

  const displayCase =
    caseData ||
    (confirmation
      ? {
          vehicleNumber: confirmation.vehicleNumber,
          customerName: confirmation.customerName,
          bankName: confirmation.bankName,
          branchName: confirmation.branchName,
          caseCode: confirmation.caseCode,
          loanAccountNumber: confirmation.loanAccountNumber,
        }
      : null);

  const caseId =
    resolveConfirmationCaseId(confirmation) || displayCase?._id || displayCase?.id;

  const { enrichedCase, enriching } = useEnrichedAdminCase(displayCase, {
    token: auth?.token,
    caseId,
    enabled: isRepoAdmin && Boolean(displayCase) && Boolean(auth?.token),
  });

  if (isRepoAdmin) {
    return (
      <AdminExcelFieldGrid
        caseData={enrichedCase || displayCase}
        loading={loading}
        enriching={enriching}
        layout="cards"
      />
    );
  }

  if (loading && !displayCase) {
    return <p className="cf-excel-loading">Loading trace details…</p>;
  }

  if (!displayCase) {
    return <p className="cf-excel-loading">No trace details available for this case.</p>;
  }

  const rows = buildLrmsTraceDetailRows(displayCase, confirmation, { isRepoAdmin: false });

  if (!rows.length) {
    return <p className="cf-excel-loading">No trace details available for this case.</p>;
  }

  return (
    <div className="lrms-trace-list" role="list">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="lrms-trace-row" role="listitem">
          <span className="lrms-trace-row__label">{row.label}</span>
          <span className="lrms-trace-row__sep">:</span>
          <span className="lrms-trace-row__value">{highlightPhones(row.value)}</span>
        </div>
      ))}
    </div>
  );
}
