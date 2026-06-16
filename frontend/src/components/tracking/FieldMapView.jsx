import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const viewerIcon = L.divIcon({
  className: "field-map-marker field-map-marker--viewer",
  html: '<span aria-hidden="true"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const tracerIcon = L.divIcon({
  className: "field-map-marker field-map-marker--tracer",
  html: '<span aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

L.Marker.prototype.options.icon = defaultIcon;

function formatUpdatedAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function FieldMapView({
  tracers = [],
  viewerLocation = null,
  selectedTracerId = null,
  onSelectTracer,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const viewerMarkerRef = useRef(null);

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
      viewerMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(tracers.map((t) => t.tracerId));

    Object.keys(markersRef.current).forEach((id) => {
      if (!nextIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    tracers.forEach((tracer) => {
      const lat = Number(tracer.latitude);
      const lng = Number(tracer.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const label = tracer.name || "Tracer";
      const popupHtml = `<strong>${label}</strong><br/>${
        tracer.vehicleNumber ? `${tracer.vehicleNumber}<br/>` : ""
      }<small>Updated ${formatUpdatedAt(tracer.updatedAt)}</small>`;

      let marker = markersRef.current[tracer.tracerId];
      if (marker) {
        marker.setLatLng([lat, lng]);
        marker.setPopupContent(popupHtml);
      } else {
        marker = L.marker([lat, lng], { icon: tracerIcon }).addTo(map);
        marker.bindPopup(popupHtml);
        marker.on("click", () => onSelectTracer?.(tracer.tracerId));
        markersRef.current[tracer.tracerId] = marker;
      }

      if (selectedTracerId === tracer.tracerId) {
        marker.openPopup();
      }
    });

    const points = tracers
      .map((t) => [Number(t.latitude), Number(t.longitude)])
      .filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));

    if (viewerLocation?.latitude != null && viewerLocation?.longitude != null) {
      const vLat = Number(viewerLocation.latitude);
      const vLng = Number(viewerLocation.longitude);
      if (Number.isFinite(vLat) && Number.isFinite(vLng)) {
        points.push([vLat, vLng]);
        if (viewerMarkerRef.current) {
          viewerMarkerRef.current.setLatLng([vLat, vLng]);
        } else {
          viewerMarkerRef.current = L.marker([vLat, vLng], { icon: viewerIcon })
            .addTo(map)
            .bindPopup("<strong>You</strong>");
        }
      }
    } else if (viewerMarkerRef.current) {
      map.removeLayer(viewerMarkerRef.current);
      viewerMarkerRef.current = null;
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
    }
  }, [tracers, viewerLocation, selectedTracerId, onSelectTracer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedTracerId) return;
    const tracer = tracers.find((t) => t.tracerId === selectedTracerId);
    if (!tracer) return;
    const lat = Number(tracer.latitude);
    const lng = Number(tracer.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], 15, { animate: true });
    }
  }, [selectedTracerId, tracers]);

  return <div ref={containerRef} className="field-map-canvas" aria-label="Field tracers map" />;
}
