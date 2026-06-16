import { useCallback, useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import confirmationService from "../../../services/confirmation.service";
import {
  buildNotifyBankApiPayload,
  buildNotifyContextFromConfirmation,
  formatNotifyApiResult,
  openBankNotifyShare,
} from "../../../utils/bankNotifyShare";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import ConfirmationCaseExcelGrid from "./ConfirmationCaseExcelGrid";
import { shouldShowAdminOnlyCaseFields } from "../../../utils/caseFieldVisibility";
import { enrichCaseWithBankerFields } from "../../../utils/enrichCaseBankerFields";
import "../../../styles/confirmation.css";

export default function PendingConfirmationDetailModal({
  confirmation,
  onClose,
  onReviewed,
  variant = "modal",
  showExtendedReview,
}) {
  const isInline = variant === "inline";
  const isPage = variant === "page";
  const isModal = variant === "modal";
  const extendedReview = showExtendedReview ?? (isModal || isPage);

  const { auth } = useAuth();
  const isRepoAdmin = shouldShowAdminOnlyCaseFields(auth?.user?.role);
  const [caseData, setCaseData] = useState(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [notifyStatus, setNotifyStatus] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const companyName = auth?.user?.company?.companyName || "";

  const loadCase = useCallback(async () => {
    if (!confirmation?.caseId || !auth?.token) return;
    setLoadingCase(true);
    setLoadError("");
    try {
      const res = await repoCaseService.getCaseById(confirmation.caseId, auth.token);
      let data = res?.data || null;
      if (data && isRepoAdmin) {
        data = await enrichCaseWithBankerFields(data, auth.token, confirmation.caseId);
      }
      setCaseData(data);
    } catch (err) {
      setCaseData(null);
      setLoadError(err?.response?.data?.message || "Could not load case details.");
    } finally {
      setLoadingCase(false);
    }
  }, [confirmation?.caseId, auth?.token, isRepoAdmin]);

  useEffect(() => {
    if (!confirmation) return;
    loadCase();
    setReviewNote("");
    setNotifyStatus("");
    setReviewStatus("");
  }, [confirmation, loadCase]);

  const notifyContext = useMemo(() => {
    if (!caseData || !confirmation) return {};
    return buildNotifyContextFromConfirmation(caseData, confirmation, auth?.user, {
      companyName,
    });
  }, [caseData, confirmation, auth?.user, companyName]);

  const handleNotifyBank = async (channel) => {
    if (!caseData || !confirmation?.caseId) return;
    setNotifySending(true);
    setNotifyStatus("");
    try {
      await openBankNotifyShare(channel, caseData, {}, notifyContext, {
        token: auth.token,
        caseId: confirmation.caseId,
      });
      if (channel === "whatsapp") {
        setNotifyStatus("WhatsApp opened with full details (copied to clipboard).");
        return;
      }

      setNotifyStatus(
        `${channel === "email" ? "Email" : "SMS"} opened with auto-filled message.`
      );

      try {
        const res = await repoCaseService.notifyBankTraced(
          confirmation.caseId,
          { ...buildNotifyBankApiPayload(channel, auth?.user), searchItem: caseData },
          auth.token
        );
        const apiNote = formatNotifyApiResult(res?.data?.results);
        if (apiNote && apiNote !== "Done.") {
          setNotifyStatus(`${channel === "email" ? "Email" : "SMS"} opened. ${apiNote}`);
        }
      } catch {
        /* client share already opened */
      }
    } catch (err) {
      setNotifyStatus(err?.response?.data?.message || "Could not open share.");
    } finally {
      setNotifySending(false);
    }
  };

  const handleReview = async (action) => {
    if (!confirmation?._id) return;
    setReviewing(true);
    setReviewStatus("");
    try {
      await confirmationService.review(
        confirmation._id,
        { action, note: reviewNote },
        auth.token
      );

      const isConfirm =
        action === "CONFIRM" || action === "IN_YARD" || action === "RELEASE";
      setReviewStatus(
        isConfirm
          ? "Trace confirmed. Case updated and notification sent to the tracer."
          : "Trace cancelled. Case updated and notification sent to the tracer."
      );

      await onReviewed?.();
      window.dispatchEvent(new CustomEvent("app:notifications-changed"));

      window.setTimeout(() => {
        onClose?.();
        setReviewStatus("");
      }, 1400);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update confirmation");
    } finally {
      setReviewing(false);
    }
  };

  if (!confirmation) return null;

  const panelClass = isPage
    ? "cfm-page-card card"
    : isInline
      ? "cfm-inline-panel card"
      : "cfm-modal";

  const content = (
    <div
      className={panelClass}
      role={isPage || isInline ? "region" : "dialog"}
      aria-modal={isModal ? "true" : undefined}
      aria-labelledby="cfm-title"
      onClick={isModal ? (e) => e.stopPropagation() : undefined}
    >
      <div className="cfm-header">
        <div>
          <h2 id="cfm-title">
            {confirmation.status === "PENDING"
              ? "Pending confirmation — traced vehicle"
              : "Confirmation details"}
          </h2>
          <p className="cfm-subtitle">
            {formatVehicleNumberDisplay(confirmation.vehicleNumber)} ·{" "}
            {confirmation.customerName || "—"}
          </p>
        </div>
        {!isPage && (
          <button type="button" className="cfm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="cfm-meta-grid">
        <div className="cfm-meta-box">
          <span className="cfm-label">Traced by</span>
          <strong>{confirmation.requestedByName || "—"}</strong>
          <span className="cfm-muted">
            {confirmation.requestedByRoleLabel || confirmation.requestedByRole}
          </span>
        </div>
        <div className="cfm-meta-box">
          <span className="cfm-label">Reporter mobile</span>
          <strong>{confirmation.requestedByPhone || "—"}</strong>
        </div>
        <div className="cfm-meta-box">
          <span className="cfm-label">Agency / company</span>
          <strong>{companyName || "—"}</strong>
        </div>
        <div className="cfm-meta-box">
          <span className="cfm-label">Admin sending to bank</span>
          <strong>{auth?.user?.name || "—"}</strong>
          <span className="cfm-muted">{auth?.user?.phone || "Add your mobile in My Mobile (sidebar)"}</span>
        </div>
        <div className="cfm-meta-box">
          <span className="cfm-label">Bank / branch</span>
          <strong>{confirmation.bankName || caseData?.bankName || "—"}</strong>
          <span className="cfm-muted">{confirmation.branchName || caseData?.branchName || "—"}</span>
        </div>
        <div className="cfm-meta-box">
          <span className="cfm-label">Field note</span>
          <strong className="cfm-note">{confirmation.requestNote || "—"}</strong>
        </div>
        </div>

        {loadingCase && <p className="cfm-muted">Loading Excel / case fields…</p>}
        {loadError && <p className="cfm-error">{loadError}</p>}

        <div className="cfm-excel-section">
          <span className="cfm-label">Case &amp; trace details (Excel sheet)</span>
          <ConfirmationCaseExcelGrid
            caseData={caseData}
            confirmation={confirmation}
            companyName={companyName}
            adminUser={auth?.user}
            loading={loadingCase}
          />
        </div>

      {notifyStatus && <p className="cfm-status">{notifyStatus}</p>}
      {reviewStatus && <p className="cfm-status cfm-status--review">{reviewStatus}</p>}

      <div className="cfm-notify-actions">
        <button
          type="button"
          className="cfm-notify-btn cfm-notify-btn--wa"
          disabled={!caseData || notifySending || reviewing}
          onClick={() => handleNotifyBank("whatsapp")}
        >
          <FaWhatsapp aria-hidden /> WhatsApp to bank
        </button>
        <button
          type="button"
          className="cfm-notify-btn cfm-notify-btn--email"
          disabled={!caseData || notifySending || reviewing}
          onClick={() => handleNotifyBank("email")}
        >
          <FaEnvelope aria-hidden /> Email
        </button>
        <button
          type="button"
          className="cfm-notify-btn cfm-notify-btn--sms"
          disabled={!caseData || notifySending || reviewing}
          onClick={() => handleNotifyBank("sms")}
        >
          <FaSms aria-hidden /> SMS
        </button>
      </div>

      {confirmation.status === "PENDING" && (
        <div className="cfm-review">
          <span className="cfm-label">Note to tracer (optional)</span>
          <textarea
            rows={2}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional note included in the tracer notification"
            disabled={reviewing}
          />
          {extendedReview && (
            <div className="cfm-review-actions">
              <button type="button" disabled={reviewing} onClick={() => handleReview("IN_YARD")}>
                In Yard
              </button>
              <button type="button" disabled={reviewing} onClick={() => handleReview("RELEASE")}>
                Release
              </button>
              <button
                type="button"
                className="cfm-reject"
                disabled={reviewing}
                onClick={() => handleReview("REJECT")}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {(confirmation.status === "PENDING" || isPage) && (
        <div
          className={`cfm-footer${isInline ? " cfm-footer--inline" : ""}${isPage ? " cfm-footer--page" : ""}`}
        >
          {confirmation.status === "PENDING" && (
            <>
              <button
                type="button"
                className="cfm-confirm"
                disabled={reviewing}
                onClick={() => handleReview("CONFIRM")}
              >
                {reviewing ? "Updating…" : "Confirm"}
              </button>
              <button
                type="button"
                className="cfm-cancel"
                disabled={reviewing}
                onClick={() => handleReview("CANCEL")}
              >
                Cancel
              </button>
            </>
          )}
          {isPage && (
            <button
              type="button"
              className={`cfm-secondary${confirmation.status !== "PENDING" ? " cfm-secondary--wide" : ""}`}
              onClick={onClose}
              disabled={reviewing}
            >
              Back to confirmations list
            </button>
          )}
          {isModal && confirmation.status === "PENDING" && (
            <button type="button" className="cfm-secondary" onClick={onClose} disabled={reviewing}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isInline || isPage) {
    return content;
  }

  return (
    <div className="cfm-overlay" role="presentation" onClick={onClose}>
      {content}
    </div>
  );
}
