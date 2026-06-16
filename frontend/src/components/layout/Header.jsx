import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import BrandWordmark from "../brand/BrandWordmark";
import NotificationPanel from "./NotificationPanel";
import { isRepoUser } from "../../utils/permissions";
import { formatRepoRole } from "../../constants/repoRoles";
import "../../styles/header.css";
import "../../styles/brand.css";

export default function Header() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  const name = auth?.user?.name || "User";
  const role = auth?.user?.role || "UNKNOWN";
  const phone = auth?.user?.phone || "";
  const initial = name?.charAt(0)?.toUpperCase() || "U";
  const isRepo = isRepoUser(role);
  const isSsdi = role === "SSDI_SUPER_ADMIN";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  if (isRepo) {
    return (
      <header className="app-header app-header--repo">
        <div className="header-panel-row">
          <h1 className="header-panel-title">Repo Company Panel</h1>
        </div>

        <div className="header-actions-row">
          <NotificationPanel />

          <div className="header-user">
            <span>{name}</span>
            <small>{formatRepoRole(role)}</small>
            {phone ? (
              <small>
                <a href={`tel:${phone}`}>{phone}</a>
              </small>
            ) : (
              <small>
                <Link to="/profile">Add mobile</Link>
              </small>
            )}
          </div>

          <div className="avatar">{initial}</div>

          <button type="button" className="header-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">
          {isSsdi ? (
            <BrandWordmark className="brand-wordmark--header" />
          ) : (
            "Repo Company Panel"
          )}
        </div>
      </div>

      <div className="header-right">
        {isSsdi && <NotificationPanel />}

        <div className={`header-user${isSsdi ? " header-user--ssdi" : ""}`}>
          {isSsdi ? (
            <BrandWordmark className="brand-wordmark--header header-user__brand" />
          ) : (
            <span>{name}</span>
          )}
          <small>{formatRepoRole(role)}</small>
        </div>

        <div className="avatar">{initial}</div>

        <button type="button" className="header-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
