import { useCallback, useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaEnvelope, FaSms, FaUser, FaBuilding } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import confirmationService from "../../../services/confirmation.service";
import {
  buildNotifyBankApiPayload,
  buildNotifyContextFromConfirmation,
  formatNotifyApiResult,
  openBankNotifyShare,
} from "../../../utils/bankNotifyShare";
import { authService } from "../../../services/auth.service";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import ConfirmationCaseExcelGrid from "./ConfirmationCaseExcelGrid";
import { shouldShowAdminOnlyCaseFields } from "../../../utils/caseFieldVisibility";
import InventoryFilesGallery from "./InventoryFilesGallery";
import { emitDashboardRefresh } from "../../../utils/dashboardEvents";
import { enrichCaseWithBankerFields } from "../../../utils/enrichCaseBankerFields";
import {
  buildFallbackCaseFromConfirmation,
  resolveConfirmationCaseId,
} from "./confirmationListUtils";
import "../../../styles/confirmation.css";
import "../../../styles/inventoryUpdate.css";

function statusLabel(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "Pending";
  if (s === "CONFIRMED") return "Confirmed";
  if (s === "REJECTED") return "Rejected";
  return status || "—";
}

function statusClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "lrms-status lrms-status--pending";
  if (s === "CONFIRMED") return "lrms-status lrms-status--confirmed";
  if (s === "REJECTED") return "lrms-status lrms-status--rejected";
  return "lrms-status";
}

export default function ConfirmationDetailPanel({
  confirmation,
  initialCase = null,
  onClose,
  onReviewed,
  onRefresh,
}) {
  const { auth, patchUser } = useAuth();
  const isRepoAdmin = shouldShowAdminOnlyCaseFields(auth?.user?.role);
  const [caseData, setCaseData] = useState(() => initialCase || null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [notifyStatus, setNotifyStatus] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [inventoryRevisionNote, setInventoryRevisionNote] = useState("");
  const [revisionStatus, setRevisionStatus] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [confirmingInventory, setConfirmingInventory] = useState(false);
  const [inventoryConfirmStatus, setInventoryConfirmStatus] = useState("");

  const companyName = auth?.user?.company?.companyName || "";
  const isPending = confirmation?.status === "PENDING";
  const isConfirmed = confirmation?.status === "CONFIRMED";
  const hasInventory = Boolean(confirmation?.inventorySubmitted);
  const inventoryConfirmed = Boolean(confirmation?.inventoryConfirmed);

  const loadCase = useCallback(async () => {
    if (!confirmation || !auth?.token) return;

    const caseId = resolveConfirmationCaseId(confirmation);
    const fallback = buildFallbackCaseFromConfirmation(confirmation);

    if (!caseId) {
      setCaseData(fallback);
      setLoadError("");
      return;
    }

    const preview = initialCase || fallback;
    if (preview) {
      setCaseData(preview);
      setLoadingCase(false);
    } else {
      setLoadingCase(true);
    }
    setLoadError("");

    const initialHasExcel =
      initialCase?.excelFields &&
      typeof initialCase.excelFields === "object" &&
      Object.keys(initialCase.excelFields).some((k) => !String(k).startsWith("_"));

    if (initialHasExcel) {
      setCaseData(initialCase);
      setLoadingCase(false);
      if (isRepoAdmin) {
        enrichCaseWithBankerFields(initialCase, auth.token, caseId)
          .then((enriched) => {
            if (enriched) setCaseData(enriched);
          })
          .catch(() => {});
      }
      return;
    }

    try {
      const res = await repoCaseService.getCaseById(caseId, auth.token);
      const data = res?.data || preview;
      setCaseData(data);
      setLoadingCase(false);

      if (data && isRepoAdmin) {
        enrichCaseWithBankerFields(data, auth.token, caseId)
          .then((enriched) => {
            if (enriched) setCaseData(enriched);
          })
          .catch(() => {});
      }
    } catch (err) {
      setCaseData(initialCase || fallback);
      setLoadError(err?.response?.data?.message || "Could not load full case details.");
      setLoadingCase(false);
    }
  }, [confirmation, auth?.token, isRepoAdmin, initialCase]);

  useEffect(() => {
    if (!confirmation) return;
    if (initialCase) {
      setCaseData(initialCase);
    }
    loadCase();
    setReviewNote("");
    setNotifyStatus("");
    setReviewStatus("");
  }, [confirmation, initialCase, loadCase]);

  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authService.getProfile(auth.token);
        const user = res?.data?.user;
        if (cancelled || !user) return;
        patchUser({
          name: user.name,
          phone: user.phone || "",
        });
      } catch {
        /* profile optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.token, patchUser]);

  const notifyContext = useMemo(() => {
    if (!caseData || !confirmation) return {};
    return buildNotifyContextFromConfirmation(caseData, confirmation, auth?.user, {
      companyName,
    });
  }, [caseData, confirmation, auth?.user, companyName]);

  const handleNotify = async (channel) => {
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

  const handleConfirmInventory = async () => {
    if (!confirmation?._id) return;
    setConfirmingInventory(true);
    setInventoryConfirmStatus("");
    try {
      await confirmationService.confirmInventory(confirmation._id, auth.token);
      setInventoryConfirmStatus("Inventory confirmed. Tracer has been notified.");
      window.dispatchEvent(new CustomEvent("app:notifications-changed"));
      emitDashboardRefresh();
      await onRefresh?.();
    } catch (err) {
      alert(err?.response?.data?.message || "Could not confirm inventory");
    } finally {
      setConfirmingInventory(false);
    }
  };

  const handleRequestInventoryRevision = async () => {
    if (!confirmation?._id) return;
    setRequestingRevision(true);
    setRevisionStatus("");
    try {
      await confirmationService.requestInventoryRevision(
        confirmation._id,
        { note: inventoryRevisionNote },
        auth.token
      );
      setRevisionStatus("Tracer notified to add or correct inventory files.");
      setInventoryRevisionNote("");
      window.dispatchEvent(new CustomEvent("app:notifications-changed"));
      await onRefresh?.();
    } catch (err) {
      alert(err?.response?.data?.message || "Could not request inventory update");
    } finally {
      setRequestingRevision(false);
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

      const isConfirm = action === "CONFIRM";
      setReviewStatus(
        isConfirm
          ? "Confirmed. Tracer notified to update inventory pre/post."
          : "Rejected. Tracer has been notified."
      );

      window.dispatchEvent(new CustomEvent("app:notifications-changed"));
      await onReviewed?.();

      window.setTimeout(() => {
        onClose?.();
        setReviewStatus("");
      }, 1200);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update confirmation");
    } finally {
      setReviewing(false);
    }
  };

  if (!confirmation) return null;

  return (
    <article className="lrms-detail card">
      <header className="lrms-detail__hero">
        <div className="lrms-detail__hero-text">
          <p className="lrms-detail__eyebrow">Repossession — trace confirmation</p>
          <h1 className="lrms-detail__title">
            {formatVehicleNumberDisplay(confirmation.vehicleNumber) || "Vehicle"}
          </h1>
          <p className="lrms-detail__sub">
            {[
              isRepoAdmin
                ? [confirmation.bankName, confirmation.branchName].filter(Boolean).join(" / ") ||
                  null
                : null,
              confirmation.requestedByName
                ? `Traced by ${confirmation.requestedByName}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <span className={statusClass(confirmation.status)}>{statusLabel(confirmation.status)}</span>
      </header>

      <section className="lrms-section lrms-contacts">
        <h2 className="lrms-section__title">Contact details</h2>
        <div className="lrms-contact-grid">
          <div className="lrms-contact-card lrms-contact-card--tracer">
            <div className="lrms-contact-card__icon" aria-hidden>
              <FaUser />
            </div>
            <div>
              <span className="lrms-label">Tracer (field report)</span>
              <strong>{confirmation.requestedByName || "—"}</strong>
              <span className="lrms-muted">
                {confirmation.requestedByRoleLabel || confirmation.requestedByRole || "—"}
              </span>
              <a
                href={
                  confirmation.requestedByPhone
                    ? `tel:${confirmation.requestedByPhone}`
                    : undefined
                }
                className="lrms-phone"
              >
                {confirmation.requestedByPhone || "No mobile on file"}
              </a>
            </div>
          </div>
          <div className="lrms-contact-card lrms-contact-card--admin">
            <div className="lrms-contact-card__icon" aria-hidden>
              <FaBuilding />
            </div>
            <div>
              <span className="lrms-label">Repo admin</span>
              <strong>{auth?.user?.name || "—"}</strong>
              <span className="lrms-muted">{companyName || "Agency"}</span>
              <a
                href={auth?.user?.phone ? `tel:${auth.user.phone}` : undefined}
                className="lrms-phone"
              >
                {auth?.user?.phone || "Add your mobile in My Mobile (sidebar)"}
              </a>
            </div>
          </div>
        </div>
      </section>

      {confirmation.requestNote && (
        <section className="lrms-section">
          <h2 className="lrms-section__title">Tracer field note</h2>
          <p className="lrms-note-box">{confirmation.requestNote}</p>
        </section>
      )}

      <section className="lrms-section lrms-section--trace-detail">
        {loadError && <p className="cfm-error">{loadError}</p>}
        <ConfirmationCaseExcelGrid
          caseData={caseData}
          confirmation={confirmation}
          loading={loadingCase}
        />
      </section>

      {isConfirmed && !hasInventory && (
        <section className="lrms-section lrms-inventory-wait">
          <p className="lrms-inventory-wait__text">
            Waiting for tracer to upload inventory pre/post. They were notified when you
            confirmed this trace.
          </p>
          <div className="lrms-inventory-revision-request">
            <label className="lrms-review-note">
              <span className="lrms-label">Remind tracer (optional note)</span>
              <textarea
                rows={2}
                value={inventoryRevisionNote}
                onChange={(e) => setInventoryRevisionNote(e.target.value)}
                placeholder="e.g. Upload yard photos and PDF checklist"
                disabled={requestingRevision}
              />
            </label>
            {revisionStatus && <p className="cfm-status">{revisionStatus}</p>}
            <button
              type="button"
              className="lrms-btn lrms-btn--confirm"
              disabled={requestingRevision}
              onClick={handleRequestInventoryRevision}
            >
              {requestingRevision ? "Sending…" : "Send inventory reminder"}
            </button>
          </div>
        </section>
      )}

      {isConfirmed && hasInventory && (
        <section className="lrms-section">
          <h2 className="lrms-section__title">Tracer inventory (pre/post)</h2>
          <p className="lrms-section__hint">
            Submitted{" "}
            {confirmation.inventorySubmittedAt
              ? new Date(confirmation.inventorySubmittedAt).toLocaleString()
              : "—"}
            .
          </p>
          {inventoryConfirmed ? (
            <p className="lrms-inventory-confirmed-banner">
              Inventory confirmed{" "}
              {confirmation.inventoryConfirmedAt
                ? new Date(confirmation.inventoryConfirmedAt).toLocaleString()
                : ""}
              .
            </p>
          ) : (
            <p className="lrms-inventory-revision-pending">
              Tracer uploaded inventory — review files below, then confirm to count this case as
              inventory confirmed.
            </p>
          )}
          {confirmation.inventoryRevisionRequested && (
            <p className="lrms-inventory-revision-pending">
              Waiting for tracer to upload additional or corrected files.
              {confirmation.inventoryRevisionNote
                ? ` Note: ${confirmation.inventoryRevisionNote}`
                : ""}
            </p>
          )}
          <InventoryFilesGallery confirmation={confirmation} />
          {!inventoryConfirmed && (
            <div className="lrms-inventory-confirm-block">
              {inventoryConfirmStatus && <p className="cfm-status">{inventoryConfirmStatus}</p>}
              <button
                type="button"
                className="lrms-btn lrms-btn--confirm"
                disabled={confirmingInventory || confirmation.inventoryRevisionRequested}
                onClick={handleConfirmInventory}
              >
                {confirmingInventory ? "Confirming…" : "Confirm inventory"}
              </button>
            </div>
          )}
          <div className="lrms-inventory-revision-request">
            <h3 className="lrms-section__title">Ask tracer to update inventory</h3>
            <p className="lrms-section__hint">
              Sends a notification so they can add more photos, videos, or PDFs to this case.
            </p>
            <label className="lrms-review-note">
              <span className="lrms-label">Note to tracer (optional)</span>
              <textarea
                rows={2}
                value={inventoryRevisionNote}
                onChange={(e) => setInventoryRevisionNote(e.target.value)}
                placeholder="e.g. Please add yard photos and RC copy"
                disabled={requestingRevision}
              />
            </label>
            {revisionStatus && <p className="cfm-status">{revisionStatus}</p>}
            <button
              type="button"
              className="lrms-btn lrms-btn--confirm"
              disabled={requestingRevision}
              onClick={handleRequestInventoryRevision}
            >
              {requestingRevision ? "Sending…" : "Request inventory update"}
            </button>
          </div>
        </section>
      )}

      <section className="lrms-section lrms-notify-section">
        <h2 className="lrms-section__title">Notify bank</h2>
        {notifyStatus && <p className="cfm-status">{notifyStatus}</p>}
        <div className="lrms-notify-btns">
          <button
            type="button"
            className="lrms-notify-btn lrms-notify-btn--wa"
            disabled={!caseData || notifySending || reviewing}
            onClick={() => handleNotify("whatsapp")}
          >
            <FaWhatsapp aria-hidden /> WhatsApp
          </button>
          <button
            type="button"
            className="lrms-notify-btn lrms-notify-btn--sms"
            disabled={!caseData || notifySending || reviewing}
            onClick={() => handleNotify("sms")}
          >
            <FaSms aria-hidden /> SMS
          </button>
          <button
            type="button"
            className="lrms-notify-btn lrms-notify-btn--email"
            disabled={!caseData || notifySending || reviewing}
            onClick={() => handleNotify("email")}
          >
            <FaEnvelope aria-hidden /> Email
          </button>
        </div>
        {!caseData && !loadingCase && (
          <p className="lrms-section__hint">Case details must load before you can send.</p>
        )}
      </section>

      {isPending && (
        <>
          <section className="lrms-section">
            <h2 className="lrms-section__title">Admin decision</h2>
            <label className="lrms-review-note">
              <span className="lrms-label">Note to tracer (optional)</span>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Included in notification to the tracer"
                disabled={reviewing}
              />
            </label>
            {reviewStatus && <p className="cfm-status cfm-status--review">{reviewStatus}</p>}
          </section>

          <footer className="lrms-decision-footer">
            <button
              type="button"
              className="lrms-btn lrms-btn--confirm"
              disabled={reviewing}
              onClick={() => handleReview("CONFIRM")}
            >
              {reviewing ? "Please wait…" : "Confirm"}
            </button>
            <button
              type="button"
              className="lrms-btn lrms-btn--reject"
              disabled={reviewing}
              onClick={() => handleReview("CANCEL")}
            >
              Reject
            </button>
            <button type="button" className="lrms-btn lrms-btn--ghost" onClick={onClose} disabled={reviewing}>
              Back to list
            </button>
          </footer>
        </>
      )}

      {!isPending && (
        null
      )}
    </article>
  );
}
