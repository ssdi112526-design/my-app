import { useCallback, useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import { repoCaseService } from "../../../services/repoCase.service";
import useAuth from "../../../hooks/useAuth";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import {
  buildNotifyBankApiPayload,
  buildNotifyContextFromCase,
  formatNotifyApiResult,
  getBankTracedShareMessage,
  openBankNotifyShare,
} from "../../../utils/bankNotifyShare";

export default function BankNotifyModal({
  open,
  onClose,
  bankName,
  branchName,
  upload,
  notifyEmail,
  notifyPhone,
  token,
  initialChannel,
  preselectedCaseId,
}) {
  const { auth } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [caseData, setCaseData] = useState(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [previewMessage, setPreviewMessage] = useState("");

  useEffect(() => {
    if (!caseData || !token) {
      setPreviewMessage("");
      return;
    }
    let cancelled = false;
    const context = buildNotifyContextFromCase(caseData, auth?.user);
    repoCaseService
      .fetchBankNotifyMessage(token, {
        caseId: caseData._id || caseData.id,
        searchItem: caseData,
        adminName: context?.admin?.name,
        adminPhone: context?.admin?.phone,
      })
      .then((res) => {
        if (!cancelled) {
          setPreviewMessage(res?.data?.message || getBankTracedShareMessage(caseData, context));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewMessage(getBankTracedShareMessage(caseData, context));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseData, auth?.user, token]);

  const loadVehicles = useCallback(async () => {
    if (!token || !bankName || !branchName) {
      setVehicles([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (upload?._id) {
        const res = await repoCaseService.getUploadVehicleNumbers(upload._id, token);
        setVehicles(Array.isArray(res?.items) ? res.items : []);
        return;
      }

      const res = await repoCaseService.getCases(token, {
        search: bankName,
        page: 1,
        limit: 500,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      const branchLower = branchName.trim().toLowerCase();
      const filtered = items.filter(
        (row) =>
          String(row.bankName || "")
            .trim()
            .toLowerCase() === bankName.trim().toLowerCase() &&
          String(row.branchName || "")
            .trim()
            .toLowerCase() === branchLower &&
          row.vehicleNumber
      );
      setVehicles(filtered);
    } catch (err) {
      setVehicles([]);
      setError(err?.response?.data?.message || "Could not load vehicles for this branch.");
    } finally {
      setLoading(false);
    }
  }, [token, bankName, branchName, upload?._id]);

  const loadCasePreview = useCallback(
    async (caseId) => {
      if (!caseId || !token) {
        setCaseData(null);
        return;
      }
      setLoadingCase(true);
      setError("");
      try {
        const res = await repoCaseService.getCaseById(caseId, token);
        setCaseData(res?.data || null);
      } catch (err) {
        setCaseData(null);
        setError(err?.response?.data?.message || "Could not load case details.");
      } finally {
        setLoadingCase(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setCaseData(null);
      setError("");
      setStatusMessage("");
      return;
    }
    loadVehicles();
  }, [open, loadVehicles]);

  useEffect(() => {
    if (!open || loading || vehicles.length === 0) return;

    const preferredId =
      preselectedCaseId && vehicles.some((v) => String(v._id) === String(preselectedCaseId))
        ? String(preselectedCaseId)
        : String(vehicles[0]._id);

    setSelectedId(preferredId);
  }, [open, loading, vehicles, preselectedCaseId]);

  useEffect(() => {
    if (!open || !selectedId) return;
    loadCasePreview(selectedId);
  }, [open, selectedId, loadCasePreview]);

  const sendViaApi = async (channel) => {
    if (!selectedId || !token) return;
    setSharing(true);
    setError("");
    setStatusMessage("");

    try {
      const res = await repoCaseService.notifyBankTraced(
        selectedId,
        buildNotifyBankApiPayload(channel, auth?.user),
        token
      );
      setStatusMessage(formatNotifyApiResult(res?.data?.results));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not send notification.");
    } finally {
      setSharing(false);
    }
  };

  const handleChannelClick = async (channel) => {
    if (!caseData) {
      setError("Loading case details…");
      return;
    }

    const context = buildNotifyContextFromCase(caseData, auth?.user);
    await openBankNotifyShare(channel, caseData, {}, context, {
      token,
    });

    if (channel === "whatsapp") {
      setStatusMessage("WhatsApp opened with auto-filled message (copied to clipboard).");
      return;
    }

    if (channel === "email") {
      setStatusMessage("Email opened with auto-filled subject and body.");
      sendViaApi("email").catch(() => {});
      return;
    }

    if (channel === "sms") {
      setStatusMessage("SMS opened with auto-filled message.");
      sendViaApi("sms").catch(() => {});
    }
  };

  if (!open) return null;

  const channelLabel =
    initialChannel === "whatsapp"
      ? "WhatsApp"
      : initialChannel === "email"
        ? "Email"
        : initialChannel === "sms"
          ? "SMS"
          : "";

  return (
    <div className="modal-overlay bd-upload-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-box bd-upload-modal bd-notify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-notify-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="bd-notify-title">Notify bank</h3>
        <p className="modal-subtitle">
          <strong>{bankName}</strong> — {branchName}
          {channelLabel ? ` · ${channelLabel}` : ""}
        </p>

        {loading && <p className="bd-upload-vehicles-hint">Loading vehicles from Excel…</p>}

        {!loading && vehicles.length === 0 && (
          <p className="bd-upload-vehicles-hint">
            No vehicles found for this bank and branch. Upload an Excel file first.
          </p>
        )}

        {!loading && vehicles.length > 0 && (
          <>
            <label className="bd-notify-field">
              <span className="bd-label">Registration number (from Excel)</span>
              <select
                className="bd-notify-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={sharing || loadingCase}
              >
                {vehicles.map((item) => (
                  <option key={item._id} value={String(item._id)}>
                    {formatVehicleNumberDisplay(item.vehicleNumber)}
                    {item.customerName ? ` — ${item.customerName}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="bd-notify-field bd-notify-preview-wrap">
              <span className="bd-label">Message preview (auto-filled from case / Excel)</span>
              <textarea
                className="bd-notify-preview"
                readOnly
                value={
                  loadingCase
                    ? "Loading case fields…"
                    : previewMessage || "No case data available."
                }
                rows={12}
              />
            </label>
          </>
        )}

        {error && <p className="bd-file-error">{error}</p>}
        {statusMessage && <p className="bd-feedback bd-success">{statusMessage}</p>}

        <div className="bd-notify-channel-actions">
          <button
            type="button"
            className="bd-notify-icon bd-notify-icon--whatsapp"
            title="WhatsApp"
            disabled={sharing || loading || loadingCase || !caseData}
            onClick={() => handleChannelClick("whatsapp")}
          >
            <FaWhatsapp aria-hidden />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            className="bd-notify-icon bd-notify-icon--email"
            title="Email"
            disabled={sharing || loading || loadingCase || !caseData}
            onClick={() => handleChannelClick("email")}
          >
            <FaEnvelope aria-hidden />
            <span>Email</span>
          </button>
          <button
            type="button"
            className="bd-notify-icon bd-notify-icon--sms"
            title="SMS"
            disabled={sharing || loading || loadingCase || !caseData}
            onClick={() => handleChannelClick("sms")}
          >
            <FaSms aria-hidden />
            <span>SMS</span>
          </button>
        </div>

        <div className="modal-actions bd-view-modal-actions">
          <button type="button" className="secondary-page-btn" onClick={onClose} disabled={sharing}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
