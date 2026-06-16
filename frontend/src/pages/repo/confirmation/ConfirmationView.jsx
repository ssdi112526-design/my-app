import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getReturnLabel, getReturnPath } from "../../../utils/navReturn";
import useAuth from "../../../hooks/useAuth";
import confirmationService from "../../../services/confirmation.service";
import ConfirmationDetailPanel from "./ConfirmationDetailPanel";
import "../../../styles/confirmation.css";

export default function ConfirmationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const returnTo = getReturnPath(new URLSearchParams(), location.state, "/confirmation?status=PENDING");
  const returnLabel = getReturnLabel(returnTo);

  const [confirmation, setConfirmation] = useState(null);
  const [initialCase, setInitialCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConfirmation = useCallback(async () => {
    if (!auth?.token || !id) return;

    try {
      setLoading(true);
      setError("");
      const res = await confirmationService.getById(id, auth.token);
      setConfirmation(res?.data?.confirmation || null);
      setInitialCase(res?.data?.case || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load confirmation");
      setConfirmation(null);
      setInitialCase(null);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, id]);

  useEffect(() => {
    if (!isRepoAdmin) {
      navigate("/confirmation", { replace: true });
      return;
    }
    loadConfirmation();
  }, [isRepoAdmin, loadConfirmation, navigate]);

  const handleClose = () => navigate(returnTo);
  const handleReviewed = () => navigate(returnTo);

  if (!isRepoAdmin) return null;

  return (
    <div className="page lrms-page">
      <div className="lrms-page__top">
        <Link to={returnTo} className="cf-view-back">
          ← Back to {returnLabel}
        </Link>
      </div>

      {loading ? (
        <div className="card cf-view-card">
          <p className="cf-excel-loading">Loading trace report…</p>
        </div>
      ) : error ? (
        <div className="card cf-view-card">
          <p className="error-text">{error}</p>
          <button type="button" className="cf-view-back-btn" onClick={handleClose}>
            Back to list
          </button>
        </div>
      ) : confirmation ? (
        <ConfirmationDetailPanel
          confirmation={confirmation}
          initialCase={initialCase}
          onClose={handleClose}
          onReviewed={handleReviewed}
          onRefresh={loadConfirmation}
        />
      ) : (
        <div className="card cf-view-card">
          <p>Confirmation not found.</p>
          <button type="button" className="cf-view-back-btn" onClick={handleClose}>
            Back to list
          </button>
        </div>
      )}
    </div>
  );
}
