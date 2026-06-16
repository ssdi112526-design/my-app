import { FiMapPin, FiX } from "react-icons/fi";
import "../../styles/fieldMap.css";

export default function LocationPermissionModal({
  open,
  onAllow,
  onDismiss,
  busy = false,
  error = "",
  description,
}) {
  if (!open) return null;

  const bodyText =
    description ||
    "Allow location access so the map can show your position alongside field tracers. Tracer locations update when they use Live Tracking on a case.";

  return (
    <div className="field-map-permission-backdrop" role="presentation">
      <div
        className="field-map-permission-dialog"
        role="dialog"
        aria-labelledby="field-map-permission-title"
        aria-modal="true"
      >
        <button
          type="button"
          className="field-map-permission-close"
          onClick={onDismiss}
          aria-label="Close"
        >
          <FiX aria-hidden />
        </button>
        <div className="field-map-permission-icon" aria-hidden>
          <FiMapPin />
        </div>
        <h2 id="field-map-permission-title">Turn on your location</h2>
        <p>{bodyText}</p>
        {error ? <p className="field-map-permission-error">{error}</p> : null}
        <div className="field-map-permission-actions">
          <button
            type="button"
            className="primary-page-btn"
            onClick={onAllow}
            disabled={busy}
          >
            {busy ? "Requesting…" : "Allow location"}
          </button>
          <button type="button" className="secondary-page-btn" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
