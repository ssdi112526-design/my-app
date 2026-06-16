import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { withReturnPath } from "../../../utils/navReturn";
import { isRepoUser } from "../../../utils/permissions";
import useAuth from "../../../hooks/useAuth";
import useIsMobile from "../../../hooks/useIsMobile";
import { dashboardService } from "../../../services/dashboard.service";
import DashboardStatsBar from "../../../components/dashboard/DashboardStatsBar";
import { onDashboardRefresh } from "../../../utils/dashboardEvents";
import { repoCaseService } from "../../../services/repoCase.service";
import "../../../styles/dashboard.css";

export default function Home() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const isFieldUser = isRepoUser(auth?.user?.role) && !isRepoAdmin;
  const hideAdminStarterCards = isMobile && isRepoAdmin;

  const [stats, setStats] = useState({
    cases: 0,
    pendingConfirmations: 0,
    confirmations: 0,
    inventoryConfirmed: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isRepoStaff = isRepoUser(auth?.user?.role);
  const useFieldStyleHero = isRepoStaff;

  const showHeroIntro =
    Boolean(error) ||
    (isRepoUser(auth?.user?.role) && !auth?.user?.phone);

  const loadDashboardStats = useCallback(async () => {
    if (!auth?.token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        dashboardService.getStatsOverview(),
        dashboardService.getPendingConfirmationsCount(),
        dashboardService.getConfirmationsCount(),
        dashboardService.getInventoryConfirmedCount(),
      ]);

      const pick = (idx, fallback = 0) => {
        const r = results[idx];
        if (r.status !== "fulfilled") return { value: fallback, failed: r.reason };
        return { value: r.value, failed: null };
      };

      const overview = pick(0);
      const pending = pick(1);
      const confirmations = pick(2);
      const inventory = pick(3);

      const checks = [overview, pending, confirmations, inventory];
      const firstForbidden = checks.find((x) => x.failed?.response?.status === 403);

      const pendingFailed = pending.failed;
      const pendingMsg =
        pendingFailed?.response?.data?.message || pendingFailed?.message;

      if (firstForbidden?.failed) {
        setError(
          firstForbidden.failed.response?.data?.message ||
            "Forbidden — restart the backend server, then log out and log in again."
        );
      } else if (pendingFailed) {
        setError(
          pendingMsg ||
            "Could not load pending confirmations. Restart the backend (port 5001) and refresh."
        );
      } else {
        setError("");
      }

      setStats({
        cases: overview?.value?.data?.cases ?? 0,
        pendingConfirmations:
          pending.value?.data?.pendingConfirmations ?? 0,
        confirmations: confirmations.value?.data?.totalConfirmations ?? 0,
        inventoryConfirmed: inventory.value?.data?.inventoryConfirmed ?? 0,
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard stats");
      setStats({
        cases: 0,
        pendingConfirmations: 0,
        confirmations: 0,
        inventoryConfirmed: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats, location.key]);

  useEffect(() => {
    if (!auth?.token) return;
    repoCaseService.warmSearchCache(auth.token).catch(() => {});
  }, [auth?.token]);

  useEffect(() => {
    return onDashboardRefresh(loadDashboardStats);
  }, [loadDashboardStats]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadDashboardStats();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadDashboardStats]);

  const handleStatClick = (key) => {
    const returnTo = `${location.pathname}${location.search}` || "/home";

    if (key === "pending") {
      navigate(withReturnPath("/confirmation?status=PENDING", returnTo));
      return;
    }

    if (key === "confirmations") {
      navigate(withReturnPath("/confirmation?status=CONFIRMED", returnTo));
      return;
    }

    if (key === "inventory") {
      navigate(
        withReturnPath(
          "/confirmation?status=CONFIRMED&view=inventory-confirmed",
          returnTo
        )
      );
      return;
    }

    if (key === "records") {
      if (isRepoAdmin) {
        navigate(withReturnPath("/bank-details", returnTo));
      } else {
        navigate("/find-vehicles");
      }
    }
  };

  return (
    <div className="content home-page">
      <section
        className={`home-hero${useFieldStyleHero ? " home-hero--field-user" : ""}${
          !showHeroIntro ? " home-hero--no-intro" : ""
        }`}
        aria-label="Dashboard overview"
      >
        {showHeroIntro && (
          <div className="home-hero__intro">
            {error && <p className="error-text">{error}</p>}
            {isRepoUser(auth?.user?.role) && !auth?.user?.phone && (
              <p className="muted home-hero__hint">
                Add your mobile in{" "}
                <Link to="/profile">Profile</Link> so trace reports and bank notify
                show your contact number.
              </p>
            )}
          </div>
        )}

        {useFieldStyleHero && (
          <div className="home-field-stats">
            <button
              type="button"
              className="home-field-uploaded-card stat stat--clickable"
              onClick={() => handleStatClick("records")}
            >
              <div className="stat-value">{loading ? "…" : stats.cases}</div>
              <div className="stat-label">
                {isRepoAdmin ? "Uploaded records" : "Total uploaded cases"}
              </div>
            </button>

            <DashboardStatsBar
              className="home-hero__stats"
              variant="field"
              stats={stats}
              loading={loading}
              activeKey=""
              onStatClick={handleStatClick}
            />
          </div>
        )}
      </section>

      <section className="home-actions" aria-label="Quick actions">
        <h3 className="home-section-title">Quick actions</h3>
        <div
          className={`starter-cards home-starter-cards${
            hideAdminStarterCards ? " home-starter-cards--single" : ""
          }${isMobile && isFieldUser ? " home-starter-cards--mobile-user" : ""}`}
        >
          {!hideAdminStarterCards && (
            <>
              <Link to="/bank-details" className="dashboard-card-link">
                <div className="card action-card dashboard-action-card">
                  <div className="action-icon">📁</div>
                  <h4>Upload Records</h4>
                  <p className="muted small">Upload repo vehicle records</p>
                </div>
              </Link>

              <Link to="/find-vehicles" className="dashboard-card-link">
                <div className="card action-card dashboard-action-card">
                  <div className="action-icon">🚗</div>
                  <h4>Find Vehicles</h4>
                  <p className="muted small">Search vehicle, customer, loan or bank</p>
                </div>
              </Link>
            </>
          )}

          <Link
            to={withReturnPath(
              isRepoAdmin ? "/confirmation?status=PENDING" : "/confirmation?status=CONFIRMED",
              "/home"
            )}
            className="dashboard-card-link"
          >
            <div className="card action-card dashboard-action-card">
              <div className="action-icon">✅</div>
              <h4>Confirmations</h4>
              <p className="muted small">
                {isRepoAdmin
                  ? "Review pending field confirmations"
                  : "View confirmed traces and upload inventory"}
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
