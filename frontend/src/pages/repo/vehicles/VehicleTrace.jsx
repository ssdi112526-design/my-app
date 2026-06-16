import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FaWhatsapp, FaEnvelope, FaSms } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import confirmationService from "../../../services/confirmation.service";
import { formatRepoRole } from "../../../constants/repoRoles";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import {
  getTraceReportToAdminMessage,
  openTraceReportShare,
  openWhatsAppUrl,
} from "../../../utils/bankNotifyShare";
import { getFullAddress, safeValue } from "./findVehiclesHelpers";
import { filterFieldsByRole } from "../../../utils/caseFieldVisibility";
import "../../../styles/vehicleTrace.css";

const TRACE_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

function isMongoCaseId(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || ""));
}

const VEHICLE_FIELDS = [
  { key: "vehicleNumber", label: "Vehicle Number", format: formatVehicleNumberDisplay },
  { key: "customerName", label: "Customer Name" },
  { key: "mobileNumber", label: "Mobile" },
  { key: "loanAccountNumber", label: "Loan Account" },
  { key: "bankName", label: "Bank" },
  { key: "branchName", label: "Branch" },
  { key: "chassisNumber", label: "Chassis" },
  { key: "caseCode", label: "Case Code" },
];

export default function VehicleTrace() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get("id");
  const vehicleFromNav = location.state?.vehicle;

  const role = auth?.user?.role;
  const canTrace = TRACE_ROLES.includes(role);
  const vehicleFields = useMemo(
    () => filterFieldsByRole(VEHICLE_FIELDS, role),
    [role]
  );

  const [vehicle, setVehicle] = useState(vehicleFromNav || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traceMode, setTraceMode] = useState("ONLINE");
  const [traceNote, setTraceNote] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const reporter = useMemo(
    () => ({
      name: auth?.user?.name || "",
      role: auth?.user?.role || "",
      roleLabel: formatRepoRole(auth?.user?.role),
      phone: auth?.user?.phone || "",
    }),
    [auth?.user]
  );

  const loadVehicle = useCallback(async () => {
    if (!caseId) {
      setLoading(false);
      setError("Missing vehicle case id.");
      return;
    }

    if (vehicleFromNav && !isMongoCaseId(caseId)) {
      setVehicle(vehicleFromNav);
      setLoading(false);
      return;
    }

    if (!auth?.token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await repoCaseService.getCaseById(caseId, auth.token);
      setVehicle(res?.data || null);
    } catch (err) {
      if (vehicleFromNav) {
        setVehicle(vehicleFromNav);
      } else {
        setError(err?.response?.data?.message || "Could not load vehicle.");
        setVehicle(null);
      }
    } finally {
      setLoading(false);
    }
  }, [auth?.token, caseId, vehicleFromNav]);

  useEffect(() => {
    loadVehicle();
  }, [loadVehicle]);

  const previewMessage = useMemo(() => {
    if (!vehicle) return "";
    const modeNote =
      traceMode === "OFFLINE"
        ? "Tracer contacted admin outside the app, then logged here."
        : "Tracer sending from the app.";
    return getTraceReportToAdminMessage(
      vehicle,
      reporter,
      { requestNote: traceNote ? `${modeNote}\n${traceNote}` : modeNote }
    );
  }, [vehicle, reporter, traceNote, traceMode]);

  const latestTrace = vehicle?.latestTraceReport;

  const saveTraceAndShare = async (channel) => {
    if (!vehicle || !auth?.token) return;

    const mongoId = isMongoCaseId(caseId) ? caseId : vehicle._id;

    setSending(true);
    setStatus("");
    setError("");

    try {
      const res = await confirmationService.create(
        {
          ...(isMongoCaseId(mongoId) ? { caseId: mongoId } : {}),
          searchItem: vehicle,
          requestNote: traceNote,
          traceMode,
          shareChannel: channel,
        },
        auth.token
      );

      await loadVehicle();

      if (channel === "whatsapp" && res?.traceReport?.whatsAppUrl) {
        openWhatsAppUrl(res.traceReport.whatsAppUrl);
        setStatus("Trace saved in app. WhatsApp opened for admin.");
      } else {
        openTraceReportShare(channel, vehicle, reporter, { requestNote: traceNote });
        setStatus(
          traceMode === "OFFLINE"
            ? `Trace logged (${traceMode.toLowerCase()}). ${channel} opened with vehicle + your details.`
            : `Trace saved and sent via ${channel}. Admin can see who traced this vehicle.`
        );
      }
      setTraceNote("");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save trace.");
    } finally {
      setSending(false);
    }
  };

  if (!canTrace) {
    return <Navigate to="/home" replace />;
  }

  if (!caseId) {
    return (
      <div className="vt-page">
        <p>
          Open a vehicle from <Link to="/find-vehicles">Find Vehicles</Link> and tap the
          card to trace.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="vt-page">
        <p className="vt-muted">Loading vehicle…</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="vt-page">
        <p className="vt-error">{error || "Vehicle not found."}</p>
        <Link to="/find-vehicles/results" className="vt-back-link">
          ← Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="vt-page">
      <div className="vt-header">
        <div>
          <button
            type="button"
            className="vt-back-link"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <h1 className="vt-title">
            {formatVehicleNumberDisplay(vehicle.vehicleNumber)}
          </h1>
          <p className="vt-muted">{safeValue(vehicle.customerName)}</p>
        </div>
      </div>

      {!isMongoCaseId(caseId) && !isMongoCaseId(vehicle._id) ? (
        <p className="vt-warn">
          This vehicle is from an Excel upload only. You can still share via WhatsApp /
          email / SMS; saving in the app needs a proper case record (contact admin).
        </p>
      ) : null}

      <div className="vt-card">
        <h2 className="vt-section-title">Tracer (you)</h2>
        <div className="vt-tracer-grid">
          <div>
            <span className="vt-label">Name</span>
            <strong>{reporter.name || "—"}</strong>
          </div>
          <div>
            <span className="vt-label">Role</span>
            <strong>{reporter.roleLabel || "—"}</strong>
          </div>
          <div>
            <span className="vt-label">Mobile</span>
            <strong>{reporter.phone || "—"}</strong>
          </div>
        </div>
      </div>

      {latestTrace ? (
        <div className="vt-card vt-card--trace">
          <h2 className="vt-section-title">Last traced by</h2>
          <p>
            <strong>{latestTrace.requestedByName || "—"}</strong> (
            {formatRepoRole(latestTrace.requestedByRole) || "—"})
            {latestTrace.requestedByPhone ? ` · ${latestTrace.requestedByPhone}` : ""}
          </p>
          <p className="vt-muted">
            {latestTrace.traceMode ? `${latestTrace.traceMode} · ` : ""}
            {latestTrace.shareChannel ? `${latestTrace.shareChannel} · ` : ""}
            {latestTrace.reportedAt
              ? new Date(latestTrace.reportedAt).toLocaleString()
              : ""}
          </p>
        </div>
      ) : null}

      <div className="vt-card">
        <h2 className="vt-section-title">Vehicle details</h2>
        <div className="vt-detail-grid">
          {vehicleFields.map(({ key, label, format }) => (
            <div key={key} className="vt-detail-item">
              <span className="vt-label">{label}</span>
              <span className="vt-value">
                {format ? format(vehicle[key]) : safeValue(vehicle[key])}
              </span>
            </div>
          ))}
          <div className="vt-detail-item vt-detail-item--full">
            <span className="vt-label">Address</span>
            <span className="vt-value">{getFullAddress(vehicle)}</span>
          </div>
        </div>
      </div>

      <div className="vt-card">
        <h2 className="vt-section-title">Trace mode</h2>
        <p className="vt-muted">
          <strong>Online</strong> — send from the app (WhatsApp / email / SMS) and save
          trace. <strong>Offline</strong> — you already contacted admin outside the app;
          log the trace here with the same details.
        </p>
        <div className="vt-mode-toggle">
          <button
            type="button"
            className={`vt-mode-btn${traceMode === "ONLINE" ? " is-active" : ""}`}
            onClick={() => setTraceMode("ONLINE")}
          >
            Online
          </button>
          <button
            type="button"
            className={`vt-mode-btn${traceMode === "OFFLINE" ? " is-active" : ""}`}
            onClick={() => setTraceMode("OFFLINE")}
          >
            Offline
          </button>
        </div>

        <label className="vt-note-label">
          Field note (optional)
          <textarea
            rows={4}
            value={traceNote}
            onChange={(e) => setTraceNote(e.target.value)}
            placeholder="Location spotted, customer met, vehicle condition…"
          />
        </label>

        <p className="vt-label">Message preview (includes vehicle + your details)</p>
        <textarea className="vt-preview" readOnly rows={8} value={previewMessage} />

        {error ? <p className="vt-error">{error}</p> : null}
        {status ? <p className="vt-status">{status}</p> : null}

        <div className="vt-share-actions">
          <button
            type="button"
            className="vt-share-btn vt-share-btn--wa"
            disabled={sending}
            onClick={() => saveTraceAndShare("whatsapp")}
          >
            <FaWhatsapp aria-hidden />
            WhatsApp
          </button>
          <button
            type="button"
            className="vt-share-btn vt-share-btn--email"
            disabled={sending}
            onClick={() => saveTraceAndShare("email")}
          >
            <FaEnvelope aria-hidden />
            Email
          </button>
          <button
            type="button"
            className="vt-share-btn vt-share-btn--sms"
            disabled={sending}
            onClick={() => saveTraceAndShare("sms")}
          >
            <FaSms aria-hidden />
            SMS
          </button>
        </div>
      </div>
    </div>
  );
}
