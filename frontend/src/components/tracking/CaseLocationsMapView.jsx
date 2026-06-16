import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/fieldMap.css";

const tracerIcon = L.divIcon({
  className: "field-map-marker field-map-marker--tracer",
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const viewerIcon = L.divIcon({
  className: "field-map-marker field-map-marker--viewer",
  html: '<span aria-hidden="true"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function formatUpdatedAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getKey(lat, lng, at, tracerName) {
  return `${lat}|${lng}|${String(at || "")}|${String(tracerName || "")}`.toLowerCase();
}

export default function CaseLocationsMapView({
  locations = [],
  height = "min(55vh, 420px)",
  className = "field-map-canvas",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);

  const normalizedLocations = useMemo(() => {
    return (Array.isArray(locations) ? locations : [])
      .map((l) => {
        const latitude = Number(l.latitude);
        const longitude = Number(l.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const createdAt = l.createdAt || l.updatedAt || null;
        return {
          ...l,
          latitude,
          longitude,
          createdAt,
        };
      })
      .filter(Boolean);
  }, [locations]);

  const latestKey = useMemo(() => {
    if (!normalizedLocations.length) return null;
    const sortedDesc = [...normalizedLocations].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const latest = sortedDesc[0];
    return getKey(latest.latitude, latest.longitude, latest.createdAt, latest.tracerName);
  }, [normalizedLocations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      if (polylineRef.current) polylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextKeys = new Set();
    normalizedLocations.forEach((l) => {
      nextKeys.add(getKey(l.latitude, l.longitude, l.createdAt, l.tracerName));
    });

    // Remove stale markers.
    Object.keys(markersRef.current).forEach((key) => {
      if (!nextKeys.has(key)) {
        map.removeLayer(markersRef.current[key]);
        delete markersRef.current[key];
      }
    });

    // Add/update markers.
    normalizedLocations.forEach((l) => {
      const key = getKey(l.latitude, l.longitude, l.createdAt, l.tracerName);
      const latlng = [l.latitude, l.longitude];
      const isLatest = latestKey && key === latestKey;

      const popupHtml = `
        <div style="font-size: 13px; line-height: 1.35;">
          <div><strong>${(l.tracerName || "Tracer").replace(/</g, "&lt;")}</strong>${
        isLatest ? " <span style=\"color:#16a34a;font-weight:700;\">(Latest)</span>" : ""
      }</div>
          <div>Updated: ${formatUpdatedAt(l.createdAt)}</div>
          <div>Lat/Lng: ${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}</div>
          ${l.accuracy != null ? `<div>Accuracy: ${Number(l.accuracy).toFixed(0)}m</div>` : ""}
          ${l.note ? `<div>Note: ${String(l.note).replace(/</g, "&lt;")}</div>` : ""}
        </div>
      `;

      let marker = markersRef.current[key];
      if (marker) {
        marker.setLatLng(latlng);
        marker.setIcon(isLatest ? viewerIcon : tracerIcon);
        marker.setPopupContent(popupHtml);
      } else {
        marker = L.marker(latlng, { icon: isLatest ? viewerIcon : tracerIcon }).addTo(map);
        marker.bindPopup(popupHtml);
        markersRef.current[key] = marker;
      }
    });

    // Polyline connecting points in chronological order.
    const asc = [...normalizedLocations].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    const polyPoints = asc.map((l) => [l.latitude, l.longitude]);
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    if (polyPoints.length >= 2) {
      polylineRef.current = L.polyline(polyPoints, {
        color: "#2563eb",
        weight: 3,
        opacity: 0.5,
      }).addTo(map);
    }

    // Fit bounds.
    if (polyPoints.length === 1) {
      map.setView(polyPoints[0], 15);
    } else if (polyPoints.length > 1) {
      map.fitBounds(polyPoints, { padding: [48, 48], maxZoom: 15 });
    }
  }, [normalizedLocations, latestKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height }}
      aria-label="Tracer locations map"
    />
  );
}

