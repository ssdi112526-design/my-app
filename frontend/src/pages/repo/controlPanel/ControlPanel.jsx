import { useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import useIsMobile from "../../../hooks/useIsMobile";
import { useControlPanel } from "../../../context/ControlPanelContext";
import { CONTROL_PANEL_CARDS } from "../../../constants/mobileControlPanel";
import "../../../styles/controlPanel.css";

export default function ControlPanel() {
  const { auth } = useAuth();
  const isMobile = useIsMobile();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const {
    isControlPanelUnlocked,
    verifyPassword,
    lock: lockControlPanel,
  } = useControlPanel();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isRepoAdmin) {
    return (
      <div className="content cp-page">
        <p className="muted">Control panel is only for repo admins.</p>
      </div>
    );
  }

  const renderCards = () => (
    <div className="home-control-grid cp-page-grid">
      {CONTROL_PANEL_CARDS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={`${item.to}-${item.title}`}
            to={item.to}
            className="home-control-tile cp-page-tile"
          >
            <span className="cp-page-tile-icon" aria-hidden>
              <Icon />
            </span>
            <strong>{item.title}</strong>
            <span>{item.desc}</span>
          </Link>
        );
      })}
    </div>
  );

  if (!isMobile) {
    return (
      <div className="content cp-page">
        <div className="cp-page-head">
          <h1>Control panel</h1>
          <p className="muted">Quick access to all management tools.</p>
        </div>
        {renderCards()}
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await verifyPassword(password.trim());
      setPassword("");
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
    <div className="content cp-page">
      <div className="cp-page-head">
        <h1>Control panel</h1>
        <p className="muted">
          {isControlPanelUnlocked
            ? "Choose a tool below. These options are not in the mobile menu."
            : "Enter your repo admin password to open management tools."}
        </p>
      </div>

      {!isControlPanelUnlocked ? (
        <div className="card cp-unlock-card">
          <form onSubmit={handleSubmit}>
            <label className="cp-modal-label" htmlFor="cp-page-password">
              Admin password
            </label>
            <input
              id="cp-page-password"
              type="password"
              className="cp-modal-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Same as login password"
              autoComplete="current-password"
              autoFocus
            />
            {error && <p className="error-text cp-modal-error">{error}</p>}
            <button type="submit" className="primary-page-btn cp-unlock-submit" disabled={submitting}>
              {submitting ? "Verifying…" : "Unlock control panel"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="cp-page-toolbar">
            <span className="cp-page-badge">Unlocked</span>
            <button
              type="button"
              className="secondary-page-btn"
              onClick={() => {
                lockControlPanel();
                setPassword("");
              }}
            >
              Lock panel
            </button>
          </div>
          {renderCards()}
        </>
      )}
    </div>
  );
}
