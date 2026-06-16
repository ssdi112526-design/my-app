import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FiMapPin, FiNavigation } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { repoCaseService } from "../../../services/repoCase.service";
import { fieldTrackingService } from "../../../services/fieldTracking.service";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import {
  canSendFieldGps,
  canViewFleetMap,
} from "../../../utils/fieldTrackingPermissions";
import "../../../styles/users.css";
import CaseLocationsMapView from "../../../components/tracking/CaseLocationsMapView";

export default function LiveTracking() {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get("caseId") || "";

  const [caseData, setCaseData] = useState(null);
  const [traceStatuses, setTraceStatuses] = useState([]);
  const [traceStatus, setTraceStatus] = useState("PENDING");
  const [timeline, setTimeline] = useState([]);
  const [lastLocation, setLastLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);

  const sendGps = canSendFieldGps(role);
  const viewFleet = canViewFleetMap(role);

  const loadCase = useCallback(async () => {
    if (!auth?.token || !caseId) return;
    try {
      const res = await repoCaseService.getCaseById(caseId, auth.token);
      const doc = res?.data || res;
      setCaseData(doc);
      setTraceStatus(doc?.traceStatus || "PENDING");
      setLastLocation(doc?.lastKnownLocation || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load case.");
    }
  }, [auth?.token, caseId]);

  const loadTimeline = useCallback(async () => {
    if (!auth?.token || !caseId) return;
    try {
      const res = await fieldTrackingService.getTimeline(caseId, auth.token);
      const data = res?.data || res;
      setTimeline(data?.timeline || []);
      if (data?.lastKnownLocation) setLastLocation(data.lastKnownLocation);
      if (data?.traceStatus) setTraceStatus(data.traceStatus);
    } catch {
      /* optional */
    }
  }, [auth?.token, caseId]);

  const loadLocations = useCallback(async () => {
    if (!auth?.token || !caseId) return;
    setLocationsLoading(true);
    try {
      const res = await fieldTrackingService.getLocations(caseId, auth.token);
      const items = res?.data?.items || [];
      setLocations(items);
    } catch {
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }, [auth?.token, caseId]);

  useEffect(() => {
    fieldTrackingService
      .getTraceStatuses(auth?.token)
      .then((res) => setTraceStatuses(res?.data || []))
      .catch(() => {});
  }, [auth?.token]);

  useEffect(() => {
    loadCase();
    loadTimeline();
    loadLocations();
  }, [loadCase, loadTimeline, loadLocations]);

  const sendPosition = async (position) => {
    if (!auth?.token || !caseId || !sendGps) return;
    const { latitude, longitude, accuracy } = position.coords;
    const res = await fieldTrackingService.postLocation(
      caseId,
      { latitude, longitude, accuracy },
      auth.token
    );

    const snapshot = res?.data?.snapshot;
    const nextLast = res?.data?.lastKnownLocation || {
      latitude,
      longitude,
      accuracy,
      updatedAt: new Date().toISOString(),
    };

    setLastLocation(nextLast);
    if (snapshot) {
      // Optimistic update so the map updates immediately.
      setLocations((prev) => [snapshot, ...prev].slice(0, 200));
    }

    await loadTimeline();
  };

  const handleCaptureOnce = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    setError("");
    setStatus("Capturing location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await sendPosition(pos);
          setStatus("Location saved.");
        } catch (err) {
          setError(err?.response?.data?.message || "Failed to save location.");
        }
      },
      () => setError("Could not get GPS location. Allow location permission."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleStartTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported.");
      return;
    }
    if (watchId != null) return;
    setTracking(true);
    setStatus("Live tracking started (updates ~15s).");
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await sendPosition(pos);
          setStatus(`Last update: ${new Date().toLocaleTimeString()}`);
        } catch {
          /* skip transient errors */
        }
      },
      () => setError("GPS tracking error."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    setWatchId(id);
  };

  const handleStopTracking = () => {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTracking(false);
    setStatus("Tracking stopped.");
  };

  const handleTraceStatusSave = async () => {
    if (!caseId) return;
    setError("");
    try {
      await fieldTrackingService.patchTraceStatus(
        caseId,
        { traceStatus },
        auth.token
      );
      setStatus("Trace status updated.");
      await loadTimeline();
      await loadCase();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update status.");
    }
  };

  const mapsUrl =
    lastLocation?.latitude != null && lastLocation?.longitude != null
      ? `https://www.google.com/maps?q=${lastLocation.latitude},${lastLocation.longitude}`
      : null;

  if (!caseId) {
    if (viewFleet) {
      return <Navigate to="/field-map" replace />;
    }
    return (
      <div className="page">
        <h2>Live tracking</h2>
        <p className="muted">Open from Cases list → Track on a case to send GPS from the field.</p>
        <Link to="/cases">Go to Cases</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="create-company-header">
        <div>
          <h2>Live tracking</h2>
          <p className="muted">
            {caseData
              ? `${formatVehicleNumberDisplay(caseData.vehicleNumber)} · ${caseData.customerName || ""}`
              : "Loading case…"}
          </p>
        </div>
        <div className="create-company-actions">
          {viewFleet ? (
            <Link to="/field-map" className="secondary-page-btn">
              Field map
            </Link>
          ) : null}
          <Link to="/cases" className="secondary-page-btn">
            All cases
          </Link>
        </div>
      </div>

      <div className="create-company-card">
        <h3>GPS location</h3>
        {lastLocation?.latitude != null ? (
          <p>
            <FiMapPin aria-hidden /> {lastLocation.latitude.toFixed(5)},{" "}
            {lastLocation.longitude.toFixed(5)}
            {lastLocation.updatedAt &&
              ` · ${new Date(lastLocation.updatedAt).toLocaleString()}`}
            {lastLocation.tracerName ? ` · ${lastLocation.tracerName}` : ""}
          </p>
        ) : (
          <p className="muted">No location captured yet.</p>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="company-btn company-btn--view"
          >
            <FiNavigation aria-hidden /> Open in Google Maps
          </a>
        )}
        {sendGps ? (
          <div className="create-company-actions" style={{ marginTop: 12 }}>
            <button type="button" className="primary-page-btn" onClick={handleCaptureOnce}>
              Capture once
            </button>
            {!tracking ? (
              <button type="button" className="secondary-page-btn" onClick={handleStartTracking}>
                Start live tracking
              </button>
            ) : (
              <button type="button" className="secondary-page-btn" onClick={handleStopTracking}>
                Stop tracking
              </button>
            )}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            View only. Field staff send GPS from this screen when they are on a case. Use{" "}
            <Link to="/field-map">Field map</Link> to watch all tracers live.
          </p>
        )}
      </div>

      <div className="create-company-card">
        <h3>Field trace status</h3>
        <div className="form-grid two-column">
          <div className="form-group">
            <label>Status</label>
            <select
              value={traceStatus}
              onChange={(e) => setTraceStatus(e.target.value)}
              disabled={!sendGps && role !== "REPO_ADMIN"}
            >
              {traceStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {(sendGps || role === "REPO_ADMIN") && (
            <div className="form-group phone-otp-actions">
              <label>&nbsp;</label>
              <button type="button" className="primary-page-btn" onClick={handleTraceStatusSave}>
                Save status
              </button>
            </div>
          )}
        </div>
      </div>

      {status && <p className="cfm-status">{status}</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="create-company-card">
        <h3>Case timeline</h3>
        {timeline.length === 0 ? (
          <p className="muted">No timeline entries yet.</p>
        ) : (
          <ul className="lrms-note-box" style={{ listStyle: "none", padding: 0 }}>
            {[...timeline].reverse().map((entry, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong>{entry.at ? new Date(entry.at).toLocaleString() : ""}</strong>
                <br />
                {entry.summary || entry.type}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="create-company-card">
        <h3>Tracer locations</h3>
        {locationsLoading ? (
          <p className="muted">Loading locations…</p>
        ) : locations.length === 0 ? (
          <p className="muted">No location snapshots yet.</p>
        ) : (
          <>
            <CaseLocationsMapView locations={locations} />
            <p className="muted" style={{ marginTop: 10 }}>
              Showing <strong>{locations.length}</strong> tracer updates for this case.
            </p>
            <ul className="lrms-note-box" style={{ listStyle: "none", padding: 0 }}>
              {[...locations].slice(0, 8).map((l, idx) => (
                <li key={`${l.createdAt || l.updatedAt || idx}`} style={{ marginBottom: 8 }}>
                  <strong>{l.tracerName || "Tracer"}</strong>
                  <br />
                  Lat/Lng:{" "}
                  {l.latitude != null && l.longitude != null
                    ? `${Number(l.latitude).toFixed(5)}, ${Number(l.longitude).toFixed(5)}`
                    : "—"}
                  <br />
                  {l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
