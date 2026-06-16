import { useEffect, useState } from "react";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import { isMongoCaseId } from "./findVehiclesHelpers";

const safeValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return value;
};

/**
 * Admin: bottom strip — bank name from upload (batch), not row/customer banker.
 */
export default function VehiclePreviewSheet({ item, onClose }) {
  const { auth } = useAuth();
  const [uploadBankName, setUploadBankName] = useState(() =>
    safeValue(item?.bankName)
  );
  const [loadingBank, setLoadingBank] = useState(false);

  useEffect(() => {
    if (!item || !auth?.token) return;

    const fallback = safeValue(item.bankName);
    setUploadBankName(fallback);

    const batchId = item.uploadBatchId;
    const caseId = isMongoCaseId(item._id || item.id) ? item._id || item.id : undefined;

    if (!batchId && !caseId) return;

    let cancelled = false;
    setLoadingBank(true);

    repoCaseService
      .getVehicleLoaded(auth.token, {
        vehicleNumber: item.vehicleNumber || "",
        chassisNumber: item.chassisNumber || "",
        caseId,
        uploadBatchId: batchId || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || res;
        const name = String(data?.uploadBankName || data?.bankName || "").trim();
        setUploadBankName(name ? name : fallback);
      })
      .catch(() => {
        if (!cancelled) setUploadBankName(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoadingBank(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item, auth?.token]);

  if (!item) return null;

  return (
    <div className="fv-preview-sheet-root fv-preview-sheet-root--bank-only" role="presentation">
      <div
        className="fv-preview-sheet fv-preview-sheet--bank-only"
        role="dialog"
        aria-modal="false"
        aria-labelledby="fv-preview-bank-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fv-preview-sheet__handle" aria-hidden />

        <header className="fv-preview-sheet__bank">
          <p className="fv-preview-sheet__bank-label">Bank name (upload)</p>
          <h2 id="fv-preview-bank-title" className="fv-preview-sheet__bank-name">
            {loadingBank ? "Loading…" : uploadBankName}
          </h2>
        </header>

        <footer className="fv-preview-sheet__actions fv-preview-sheet__actions--bank-only">
          <button
            type="button"
            className="fv-preview-sheet__btn fv-preview-sheet__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
