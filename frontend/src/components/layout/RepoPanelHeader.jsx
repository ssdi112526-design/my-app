import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useIsMobile from "../../hooks/useIsMobile";
import { isRepoAgent, isRepoUser } from "../../utils/permissions";
import AgencyWelcomeBrand from "./AgencyWelcomeBrand";
import "../../styles/repo-panel-header.css";

export default function RepoPanelHeader() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const name = auth?.user?.name || "User";
  const role = auth?.user?.role || "";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  if (!isRepoUser(role)) {
    return null;
  }

  const isFindVehiclesRoute = location.pathname.startsWith("/find-vehicles");
  const hideFieldUserMobileChrome =
    isMobile && isRepoAgent(role) && isFindVehiclesRoute;

  return (
    <div
      className={`repo-panel-chrome${
        hideFieldUserMobileChrome ? " repo-panel-chrome--fv-field-mobile" : ""
      }`}
    >
      <div className="repo-header-agency" aria-label="Agency">
        <AgencyWelcomeBrand className="agency-welcome--header" />
      </div>

      <header className="repo-admin-bar">
        <div className="repo-admin-bar-left">
          <h1 className="repo-greeting">
            Hi, <span className="repo-greeting-name">{name}</span>
          </h1>
        </div>

        <div className="repo-admin-bar-right">
          <button
            type="button"
            className="repo-logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>
    </div>
  );
}
