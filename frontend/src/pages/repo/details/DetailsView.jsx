import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import { getReturnLabel, getReturnPath } from "../../../utils/navReturn";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import confirmationService from "../../../services/confirmation.service";
import { fieldTrackingService } from "../../../services/fieldTracking.service";
import CaseLocationsMapView from "../../../components/tracking/CaseLocationsMapView";
import {
  buildNotifyBankApiPayload,
  buildNotifyContextFromCase,
  formatNotifyApiResult,
  getBankTracedShareMessage,
  getTraceReportToAdminMessage,
  openBankNotifyShare,
  openWhatsAppUrl,
} from "../../../utils/bankNotifyShare";
import { DEMO_TRACE_NOTE } from "../../../utils/demoTraceData";
import AdminExcelFieldGrid from "../../../components/repo/AdminExcelFieldGrid";
import { useEnrichedAdminCase } from "../../../hooks/useEnrichedAdminCase";
import "../../../styles/detailsView.css";
import "../../../styles/confirmation.css";

const formatDateTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
};

export default function DetailsView() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const returnTo = getReturnPath(searchParams, location.state, "/cases");
  const returnLabel = getReturnLabel(returnTo);

  const caseId = searchParams.get("id");
  const canSendConfirmation = [
    "TEAM_LEADER",
    "HEAD_OFFICE_STAFF",
    "OFFICE_STAFF",
    "REPO_STAFF",
    "REPO_VIEWER",
  ].includes(auth?.user?.role);
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  const [caseData, setCaseData] = useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [confirmationNote, setConfirmationNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRemark, setSavingRemark] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [error, setError] = useState("");

  // Vehicle number lookup: "who traced it" (latest confirmation) per matching case.
  const [vehicleLookup, setVehicleLookup] = useState("");
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [vehicleLookupError, setVehicleLookupError] = useState("");
  const [vehicleLookupResults, setVehicleLookupResults] = useState(null);
  const [notifyStatus, setNotifyStatus] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const [tracerLocations, setTracerLocations] = useState([]);
  const [tracerLocationsLoading, setTracerLocationsLoading] = useState(false);
  const [tracerLocationsError, setTracerLocationsError] = useState("");

  const { enrichedCase: adminCaseData, enriching: adminCaseEnriching } = useEnrichedAdminCase(
    caseData,
    {
      token: auth?.token,
      caseId,
      enabled: isRepoAdmin && Boolean(caseData) && Boolean(auth?.token),
    }
  );

  const notifyContext = buildNotifyContextFromCase(caseData, auth?.user, auth?.user?.company);
  const notifyPreview = caseData ? getBankTracedShareMessage(caseData, notifyContext) : "";

  const staffTracePreview = useMemo(() => {
    if (!caseData || !canSendConfirmation) return "";
    return getTraceReportToAdminMessage(
      caseData,
      {
        name: auth?.user?.name,
        role: auth?.user?.role,
        phone: auth?.user?.phone,
      },
      { requestNote: confirmationNote }
    );
  }, [caseData, canSendConfirmation, auth?.user, confirmationNote]);

  const handleFillDemoTrace = () => {
    setConfirmationNote(DEMO_TRACE_NOTE);
  };

  const handleVehicleLookup = async (e) => {
    e?.preventDefault?.();
    setVehicleLookupError("");

    const needle = String(vehicleLookup || "").trim();
    if (!needle) {
      setVehicleLookupError("Enter a vehicle number to search.");
      return;
    }

    if (!auth?.token) {
      setVehicleLookupError("You are not logged in.");
      return;
    }

    try {
      setVehicleLookupLoading(true);
      setVehicleLookupResults(null);

      const res = await repoCaseService.searchTracesByVehicleNumber(
        needle,
        auth.token
      );
      setVehicleLookupResults(res?.items || []);
    } catch (err) {
      setVehicleLookupError(
        err?.response?.data?.message || err?.message || "Vehicle search failed."
      );
    } finally {
      setVehicleLookupLoading(false);
    }
  };

  const loadCase = useCallback(async () => {
    if (!auth?.token || !caseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await repoCaseService.getCaseById(caseId, auth.token);
      setCaseData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load case details");
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, caseId]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const loadTracerLocations = useCallback(async () => {
    if (!auth?.token || !caseId) return;
    try {
      setTracerLocationsLoading(true);
      setTracerLocationsError("");
      const res = await fieldTrackingService.getLocations(caseId, auth.token);
      const items = res?.data?.items || [];
      setTracerLocations(items);
    } catch (err) {
      setTracerLocationsError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load tracer locations."
      );
      setTracerLocations([]);
    } finally {
      setTracerLocationsLoading(false);
    }
  }, [auth?.token, caseId]);

  useEffect(() => {
    if (!isRepoAdmin) return;
    loadTracerLocations();
  }, [isRepoAdmin, loadTracerLocations]);

  const handleAddRemark = async () => {
    const text = remarkText.trim();

    if (!text) {
      alert("Please enter remark text");
      return;
    }

    try {
      setSavingRemark(true);
      await repoCaseService.addRemark(caseId, text, auth.token);
      setRemarkText("");
      await loadCase();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to add remark");
    } finally {
      setSavingRemark(false);
    }
  };

  const handleSendConfirmation = async () => {
    if (!caseData?._id) return;

    try {
      setSendingConfirmation(true);

      const res = await confirmationService.create(
        {
          caseId: caseData._id,
          requestNote: confirmationNote,
        },
        auth.token
      );
      const traceReport = res?.traceReport;

      setConfirmationNote("");
      await loadCase();

      if (traceReport?.whatsAppUrl) {
        openWhatsAppUrl(traceReport.whatsAppUrl);
        alert(
          "Trace report sent. WhatsApp opened for admin with all Excel / case details auto-filled."
        );
      } else {
        alert("Trace report saved. Admin notified in the app.");
      }
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to send confirmation request");
    } finally {
      setSendingConfirmation(false);
    }
  };

  const handleNotifyBankShare = async (channel) => {
    if (!caseData || !caseId || !auth?.token) return;
    setNotifyStatus("");
    setNotifySending(true);

    try {
      await openBankNotifyShare(channel, caseData, {}, notifyContext, {
        token: auth.token,
      });
      if (channel === "whatsapp") {
        setNotifyStatus("WhatsApp opened with auto-filled message (copied to clipboard).");
        return;
      }

      setNotifyStatus(
        `${channel === "email" ? "Email" : "SMS"} opened with auto-filled message.`
      );

      try {
        const res = await repoCaseService.notifyBankTraced(
          caseId,
          buildNotifyBankApiPayload(channel, auth?.user),
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

  if (!isRepoAdmin) {
    return <Navigate to="/find-vehicles" replace />;
  }

  if (!caseId) {
    return <Navigate to="/cases" replace />;
  }

  const backLink = (
    <div className="details-page__top">
      <Link to={returnTo} className="cf-view-back">
        ← Back to {returnLabel}
      </Link>
    </div>
  );

  if (loading) {
    return (
      <div className="details-page">
        {backLink}
        <div className="details-card">
          <h2 className="details-title">Case Details</h2>
          <p>Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="details-page">
        {backLink}
        <div className="details-card">
          <h2 className="details-title">Case Details</h2>
          <p className="error-text">{error}</p>
          <Link to={returnTo} className="cf-view-back-btn">
            Back to {returnLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="details-page">
        {backLink}
        <div className="details-card">
          <h2 className="details-title">Case Details</h2>
          <p>Case not found.</p>
          <Link to={returnTo} className="cf-view-back-btn">
            Back to {returnLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="details-page">
      {backLink}
      <div className="details-card">
        <div className="details-topbar">
          <h2 className="details-title">Case Details</h2>
        </div>

        <div className="details-grid">
          <div className="details-item">
            <span className="details-label">Case Code</span>
            <div className="details-value">{caseData.caseCode || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Customer Name</span>
            <div className="details-value">{caseData.customerName || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Vehicle Number</span>
            <div className="details-value">{caseData.vehicleNumber || "-"}</div>
          </div>

          {!isRepoAdmin ? (
            <div className="details-item">
              <span className="details-label">Mobile Number</span>
              <div className="details-value">{caseData.mobileNumber || "-"}</div>
            </div>
          ) : null}

          {isRepoAdmin ? (
            <div className="details-item full">
              <span className="details-label">Uploaded Excel sheet (all columns)</span>
              <AdminExcelFieldGrid
                caseData={adminCaseData || caseData}
                enriching={adminCaseEnriching}
                layout="cards"
                className="details-excel-sheet"
              />
            </div>
          ) : null}

          <div className="details-item">
            <span className="details-label">Assigned User</span>
            <div className="details-value">{caseData?.assignedToUserId?.name || "-"}</div>
          </div>

          <div className="details-item full">
            <span className="details-label">Latest traced by</span>
            <div className="details-value">
              {caseData?.latestTraceReport?.requestedByName ? (
                <>
                  {caseData.latestTraceReport.requestedByName} ·{" "}
                  {caseData.latestTraceReport.requestedByRoleLabel ||
                    caseData.latestTraceReport.requestedByRole ||
                    "—"}
                  {caseData.latestTraceReport.requestedByPhone ? (
                    <> · {caseData.latestTraceReport.requestedByPhone}</>
                  ) : null}
                  {caseData.latestTraceReport.reportedAt ? (
                    <>
                      {" "}
                      · {new Date(caseData.latestTraceReport.reportedAt).toLocaleString()}
                    </>
                  ) : null}
                </>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="details-item full">
            <span className="details-label">Tracer last known GPS</span>
            <div className="details-value">
              {caseData?.lastKnownLocation?.latitude != null &&
              caseData?.lastKnownLocation?.longitude != null ? (
                <>
                  {caseData?.lastKnownLocation?.tracerName
                    ? `Tracer: ${caseData.lastKnownLocation.tracerName} · `
                    : ""}
                  Lat/Lng:{" "}
                  {Number(caseData.lastKnownLocation.latitude).toFixed(5)},{" "}
                  {Number(caseData.lastKnownLocation.longitude).toFixed(5)}
                  {caseData?.lastKnownLocation?.updatedAt ? (
                    <> · {new Date(caseData.lastKnownLocation.updatedAt).toLocaleString()}</>
                  ) : null}
                  <div style={{ marginTop: 8 }}>
                    <a
                      href={`https://www.google.com/maps?q=${caseData.lastKnownLocation.latitude},${caseData.lastKnownLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}
                    >
                      Open in Google Maps
                    </a>
                  </div>
                </>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="details-item">
            <span className="details-label">Repo Status</span>
            <div className="details-value">{caseData.repoStatus || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Confirmation Status</span>
            <div className="details-value">{caseData.confirmationStatus || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Pending Confirmation</span>
            <div className="details-value">
              {caseData.repoStatus === "PENDING_CONFIRMATION" || caseData.confirmationStatus === "PENDING"
                ? "Yes"
                : "No"}
            </div>
          </div>

          <div className="details-item">
            <span className="details-label">OTP Status</span>
            <div className="details-value">{caseData.otpStatus || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Blacklist Status</span>
            <div className="details-value">{caseData.blacklistStatus || "-"}</div>
          </div>

          <div className="details-item full">
            <span className="details-label">Address</span>
            <div className="details-value">
              {[
                caseData.addressLine1,
                caseData.addressLine2,
                caseData.city,
                caseData.district,
                caseData.state,
                caseData.pincode,
              ]
                .filter(Boolean)
                .join(", ") || "-"}
            </div>
          </div>

          <div className="details-item full">
            <span className="details-label">Field Notes</span>
            <div className="details-value">{caseData.fieldNotes || "-"}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Last Action</span>
            <div className="details-value">{formatDateTime(caseData.lastActionAt)}</div>
          </div>

          <div className="details-item">
            <span className="details-label">Created At</span>
            <div className="details-value">{formatDateTime(caseData.createdAt)}</div>
          </div>
        </div>
      </div>

      {isRepoAdmin && (
        <>
          <div className="details-card">
            <h3 className="details-section-title">Tracer report</h3>
            <div className="details-grid">
              <div className="details-item">
                <span className="details-label">Tracer name</span>
                <div className="details-value">
                  {caseData?.latestTraceReport?.requestedByName || "-"}
                </div>
              </div>

              <div className="details-item">
                <span className="details-label">Tracer role</span>
                <div className="details-value">
                  {caseData?.latestTraceReport?.requestedByRoleLabel ||
                    caseData?.latestTraceReport?.requestedByRole ||
                    "-"}
                </div>
              </div>

              <div className="details-item">
                <span className="details-label">Reporter mobile</span>
                <div className="details-value">
                  {caseData?.latestTraceReport?.requestedByPhone || "-"}
                </div>
              </div>

              <div className="details-item">
                <span className="details-label">Trace status</span>
                <div className="details-value">{caseData?.latestTraceReport?.status || "-"}</div>
              </div>

              <div className="details-item full">
                <span className="details-label">Tracer report (field note)</span>
                <div className="details-value">
                  {caseData?.latestTraceReport?.requestNote || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="details-card">
            <h3 className="details-section-title">Tracer locations (where traced)</h3>
            {tracerLocationsLoading ? (
              <p className="muted">Loading tracer locations…</p>
            ) : tracerLocationsError ? (
              <p className="error-text">{tracerLocationsError}</p>
            ) : tracerLocations.length === 0 ? (
              <p className="muted">No tracer location snapshots found for this case yet.</p>
            ) : (
              <>
                <CaseLocationsMapView locations={tracerLocations} />
                <p className="muted" style={{ marginTop: 10 }}>
                  Showing <strong>{tracerLocations.length}</strong> tracer updates.
                </p>
              </>
            )}
          </div>
        </>
      )}

      {canSendConfirmation && (
        <div className="details-card">
          <h3 className="details-section-title">Report traced vehicle to admin</h3>
          <p className="details-muted">
            Team leader / staff submit trace details without photos. Admin receives the full Excel
            case data on WhatsApp automatically. After admin confirms, you upload inventory
            pre/post files (images, videos, PDFs).
          </p>

          <label className="details-notify-preview-wrap">
            <span className="details-label">Preview — WhatsApp message to admin (auto-filled)</span>
            <textarea
              className="details-notify-preview"
              readOnly
              value={staffTracePreview || "Fill field note or use demo data to preview the message."}
              rows={10}
            />
          </label>

          <div className="details-remark-box">
            <textarea
              value={confirmationNote}
              onChange={(e) => setConfirmationNote(e.target.value)}
              rows={4}
              placeholder="Enter field note / live situation note for admin"
            />
          </div>

          <div className="details-trace-actions">
            <button
              type="button"
              className="details-btn details-btn-secondary"
              onClick={handleFillDemoTrace}
              disabled={sendingConfirmation}
            >
              Fill demo data
            </button>
            <button
              className="details-btn"
              onClick={handleSendConfirmation}
              disabled={sendingConfirmation}
            >
              {sendingConfirmation ? "Sending..." : "Send trace to admin (WhatsApp)"}
            </button>
          </div>
        </div>
      )}

      {null}
    </div>
  );
}