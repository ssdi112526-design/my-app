import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import useSocket from "../../../hooks/useSocket";
import { fieldTrackingService } from "../../../services/fieldTracking.service";
import { canViewFleetMap } from "../../../utils/fieldTrackingPermissions";
import FieldMapView from "../../../components/tracking/FieldMapView";
import LocationPermissionModal from "../../../components/tracking/LocationPermissionModal";
import "../../../styles/fieldMap.css";
import "../../../styles/users.css";

import {
  isLocationPermissionDismissed,
  isLocationPermissionGranted,
  markLocationPermissionDismissed,
  markLocationPermissionGranted,
} from "../../../constants/locationPermission";

function mergeTracer(list, incoming) {
  if (!incoming?.tracerId) return list;
  const idx = list.findIndex((t) => t.tracerId === incoming.tracerId);
  const row = {
    tracerId: incoming.tracerId,
    name: incoming.tracerName || incoming.name || "Tracer",
    phone: incoming.phone || "",
    post: incoming.post || "",
    role: incoming.role || "REPO_STAFF",
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    accuracy: incoming.accuracy,
    updatedAt: incoming.updatedAt || new Date().toISOString(),
    caseId: incoming.caseId || null,
    vehicleNumber: incoming.vehicleNumber || "",
  };
  if (idx === -1) return [row, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...row };
  return next;
}

export default function FieldMap() {
  const { auth } = useAuth();
  const role = auth?.user?.role;

  const [tracers, setTracers] = useState([]);
  const [selectedTracerId, setSelectedTracerId] = useState(null);
  const [viewerLocation, setViewerLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);

  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState("");

  const loadTracers = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");
      const res = await fieldTrackingService.getLiveTracers(auth.token);
      const items = res?.data?.items || [];
      setTracers(items);
      setRefreshedAt(res?.data?.refreshedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load tracer locations.");
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  const onSocketEvent = useCallback((event, payload) => {
    if (event === "tracer:location" && payload) {
      setTracers((prev) => mergeTracer(prev, payload));
      setRefreshedAt(new Date().toISOString());
    }
  }, []);

  useSocket(onSocketEvent);

  useEffect(() => {
    loadTracers();
    const id = window.setInterval(loadTracers, 60000);
    return () => window.clearInterval(id);
  }, [loadTracers]);

  useEffect(() => {
    if (!canViewFleetMap(role)) return;
    if (
      isLocationPermissionDismissed() ||
      isLocationPermissionGranted() ||
      viewerLocation
    ) {
      return;
    }
    setPermissionOpen(true);
  }, [role, viewerLocation]);

  const requestViewerLocation = () => {
    if (!navigator.geolocation) {
      setPermissionError("Geolocation is not supported on this device.");
      return;
    }
    setPermissionBusy(true);
    setPermissionError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setViewerLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setPermissionOpen(false);
        setPermissionBusy(false);
        markLocationPermissionGranted();
      },
      () => {
        setPermissionError(
          "Location blocked. Enable location in browser settings to see yourself on the map."
        );
        setPermissionBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const dismissPermission = () => {
    markLocationPermissionDismissed();
    setPermissionOpen(false);
    setPermissionError("");
  };

  const selectedTracer = useMemo(
    () => tracers.find((t) => t.tracerId === selectedTracerId) || null,
    [tracers, selectedTracerId]
  );

  if (!canViewFleetMap(role)) {
    return <Navigate to="/live-tracking" replace />;
  }

  const isTeamLeader = role === "TEAM_LEADER";

  return (
    <div className="page field-map-page">
      <div className="create-company-header">
        <div>
          <h2>Field map</h2>
          <p className="muted">
            {isTeamLeader
              ? "Watch your field tracers live. Locations update when they track a case."
              : "Watch all field tracers in your agency on the map."}
          </p>
        </div>
        <div className="create-company-actions">
          <button
            type="button"
            className="secondary-page-btn"
            onClick={loadTracers}
            disabled={loading}
          >
            <FiRefreshCw aria-hidden /> Refresh
          </button>
          <Link to="/cases" className="secondary-page-btn">
            Cases
          </Link>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {refreshedAt ? (
        <p className="field-map-sidebar-meta">
          Last refreshed: {new Date(refreshedAt).toLocaleString()}
        </p>
      ) : null}

      <div className="field-map-layout">
        <div className="field-map-panel">
          <FieldMapView
            tracers={tracers}
            viewerLocation={viewerLocation}
            selectedTracerId={selectedTracerId}
            onSelectTracer={setSelectedTracerId}
          />
        </div>

        <aside className="field-map-sidebar">
          <h3>Active tracers ({tracers.length})</h3>
          {loading && tracers.length === 0 ? (
            <p className="field-map-sidebar-meta">Loading…</p>
          ) : null}
          {!loading && tracers.length === 0 ? (
            <div className="field-map-empty">
              No tracer locations in the last 24 hours. Ask field staff to open a case,
              go to <strong>Track</strong>, and start live tracking.
            </div>
          ) : (
            <ul className="field-map-tracer-list">
              {tracers.map((tracer) => (
                <li key={tracer.tracerId} className="field-map-tracer-row">
                  <button
                    type="button"
                    className={`field-map-tracer-item${
                      selectedTracerId === tracer.tracerId ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedTracerId(tracer.tracerId)}
                  >
                    <strong>{tracer.name}</strong>
                    {tracer.vehicleNumber ? (
                      <span className="field-map-tracer-vehicle">{tracer.vehicleNumber}</span>
                    ) : null}
                    <span>
                      Updated {new Date(tracer.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  {tracer.caseId ? (
                    <Link
                      className="field-map-case-link"
                      to={`/live-tracking?caseId=${tracer.caseId}`}
                    >
                      Open case tracking
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {selectedTracer ? (
            <p className="field-map-sidebar-meta">
              Selected: <strong>{selectedTracer.name}</strong>
            </p>
          ) : null}
        </aside>
      </div>

      <LocationPermissionModal
        open={permissionOpen}
        onAllow={requestViewerLocation}
        onDismiss={dismissPermission}
        busy={permissionBusy}
        error={permissionError}
      />
    </div>
  );
}
