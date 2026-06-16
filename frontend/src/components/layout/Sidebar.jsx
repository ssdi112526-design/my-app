import { NavLink, useNavigate } from "react-router-dom";
import {
  FiHome,
  FiLogOut,
  FiSearch,
  FiFileText,
  FiUser,
  FiUpload,
  FiLock,
  FiUserX,
  FiMessageCircle,
  FiDollarSign,
  FiSettings,
  FiLayers,
  FiBriefcase,
  FiSmartphone,
  FiMapPin,
  FiNavigation,
  FiList,
  FiX,
  FiGrid,
  FiCreditCard,
  FiDatabase,
} from "react-icons/fi";
import useAuth from "../../hooks/useAuth";
import useIsMobile from "../../hooks/useIsMobile";
import { STAFF_PROFILE_MENU_LABEL } from "../../constants/companyLabels";
import { MOBILE_ADMIN_SIDEBAR_PATHS } from "../../constants/mobileControlPanel";
import { useMobileNav } from "../../contexts/MobileNavContext";
import "../../styles/sidebar.css";

const ROLE_MENU_ACCESS = {
  REPO_ADMIN: [
    "/home",
    "/profile",
    "/id-card",
    "/plans",
    "/cases",
    "/field-map",
    "/live-tracking",
    "/find-vehicles",
    "/reports",
    "/users",
    "/bank-details",
    "/bank-records",
    "/control-panel",
    "/otps",
    "/blacklist",
    "/feedback",
    "/finances",
    "/clean-file",
  ],
  TEAM_LEADER: [
    "/home",
    "/profile",
    "/id-card",
    "/confirmation",
    "/inventory-update",
    "/bank-records",
    "/field-map",
    "/live-tracking",
    "/find-vehicles",
    "/feedback",
  ],
  HEAD_OFFICE_STAFF: [
    "/home",
    "/profile",
    "/id-card",
    "/confirmation",
    "/inventory-update",
    "/bank-records",
    "/live-tracking",
    "/find-vehicles",
    "/feedback",
  ],
  OFFICE_STAFF: [
    "/home",
    "/profile",
    "/id-card",
    "/confirmation",
    "/inventory-update",
    "/bank-records",
    "/live-tracking",
    "/find-vehicles",
    "/feedback",
  ],
  REPO_STAFF: [
    "/home",
    "/profile",
    "/id-card",
    "/confirmation",
    "/inventory-update",
    "/bank-records",
    "/live-tracking",
    "/find-vehicles",
    "/feedback",
  ],
  REPO_VIEWER: [
    "/home",
    "/profile",
    "/id-card",
    "/live-tracking",
    "/find-vehicles",
    "/reports",
  ],
};

export default function Sidebar() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { closeNav } = useMobileNav();

  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  const menu = [
    { to: "/home", label: "Home", icon: <FiHome /> },
    { to: "/control-panel", label: "Control Panel", icon: <FiGrid />, mobileAdminOnly: true },
    {
      to: "/profile",
      label: STAFF_PROFILE_MENU_LABEL,
      icon: isRepoAdmin ? <FiBriefcase /> : <FiUser />,
    },
    { to: "/id-card", label: "ID Card", icon: <FiCreditCard /> },
    { to: "/plans", label: "Plans", icon: <FiLayers /> },
    { to: "/cases", label: "Trace Cases", icon: <FiList /> },
    { to: "/find-vehicles", label: "Find Vehicles", icon: <FiSearch /> },
    { to: "/field-map", label: "Field Map", icon: <FiMapPin />, fleetMapOnly: true },
    { to: "/live-tracking", label: "Live Tracking", icon: <FiNavigation /> },
    { to: "/reports", label: "Reports", icon: <FiFileText /> },
    { to: "/users", label: "Users", icon: <FiUser /> },
    { to: "/bank-details", label: "Upload Records", icon: <FiUpload /> },
    { to: "/bank-records", label: "Bank Records", icon: <FiDatabase /> },
    { to: "/otps", label: "OTPs", icon: <FiLock /> },
    { to: "/blacklist", label: "Blacklist", icon: <FiUserX /> },
    { to: "/feedback", label: "Feedback", icon: <FiMessageCircle /> },
    { to: "/finances", label: "Finances", icon: <FiDollarSign /> },
    { to: "/clean-file", label: "Clean File", icon: <FiSettings /> },
  ];

  const allowed = ROLE_MENU_ACCESS[auth?.user?.role] || [];
  const useMobileAdminMenu = isMobile && isRepoAdmin;

  const handleLogout = () => {
    closeNav();
    logout();
    navigate("/", { replace: true });
  };

  const filteredMenu = menu.filter((item) => {
    if (item.mobileAdminOnly && !useMobileAdminMenu) return false;
    if (item.fleetMapOnly && !["REPO_ADMIN", "TEAM_LEADER"].includes(auth?.user?.role)) {
      return false;
    }
    if (!allowed.includes(item.to)) return false;
    if (useMobileAdminMenu) {
      return MOBILE_ADMIN_SIDEBAR_PATHS.includes(item.to);
    }
    return true;
  });

  return (
    <aside className="sidebar sidebar--repo">
      <div className="sidebar-head sidebar-head--repo">
        <button
          type="button"
          className="sidebar-close"
          onClick={closeNav}
          aria-label="Close menu"
        >
          <FiX aria-hidden />
        </button>
      </div>

      <nav className="sidebar-nav">
        {filteredMenu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeNav}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "active" : ""}`
            }
          >
            <span className="item-icon">{item.icon}</span>
            <span className="item-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          <span className="item-icon">
            <FiLogOut aria-hidden />
          </span>
          <span className="item-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}