import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useControlPanel } from "../../context/ControlPanelContext";
import { DEFAULT_LANDING_PATH } from "../../utils/navReturn";
import "../../styles/controlPanel.css";

export default function MobileAdminGate() {
  const navigate = useNavigate();
  const { verifyPassword } = useControlPanel();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await verifyPassword(password.trim());
      setPassword("");
      navigate(DEFAULT_LANDING_PATH, { replace: true });
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
    <div className="mobile-admin-gate">
      <div className="mobile-admin-gate__card">
        <h1 className="mobile-admin-gate__title">Repo admin</h1>
        <p className="mobile-admin-gate__text">
          Enter your password to open the dashboard on this device.
        </p>

        <form className="mobile-admin-gate__form" onSubmit={handleSubmit}>
          <label className="cp-modal-label" htmlFor="mobile-admin-password">
            Password
          </label>
          <input
            id="mobile-admin-password"
            type="password"
            className="cp-modal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your login password"
            autoComplete="current-password"
            autoFocus
          />
          {error && <p className="error-text mobile-admin-gate__error">{error}</p>}
          <button
            type="submit"
            className="primary-page-btn mobile-admin-gate__submit"
            disabled={submitting}
          >
            {submitting ? "Verifying…" : "Continue to Find Vehicles"}
          </button>
        </form>
      </div>
    </div>
  );
}
