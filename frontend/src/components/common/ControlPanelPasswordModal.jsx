import { useState } from "react";
import "../../styles/controlPanel.css";

export default function ControlPanelPasswordModal({
  open,
  onClose,
  onVerified,
  verifyPassword,
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await verifyPassword(password.trim());
      setPassword("");
      if (typeof onVerified === "function") onVerified();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Incorrect password. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay cp-modal-overlay" onClick={onClose}>
      <div
        className="modal-card cp-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cp-modal-title"
      >
        <h3 id="cp-modal-title">Control panel</h3>
        <p className="cp-modal-text muted">
          Enter your repo admin password to unlock full management tools in the
          sidebar and on this dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="cp-modal-label" htmlFor="cp-password">
            Admin password
          </label>
          <input
            id="cp-password"
            type="password"
            className="cp-modal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your login password"
            autoComplete="current-password"
            autoFocus
          />
          {error && <p className="error-text cp-modal-error">{error}</p>}
          <div className="modal-actions cp-modal-actions">
            <button
              type="button"
              className="secondary-page-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="primary-page-btn" disabled={submitting}>
              {submitting ? "Verifying…" : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
