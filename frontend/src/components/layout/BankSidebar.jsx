import { NavLink } from "react-router-dom";
import {
  FiGrid,
  FiUsers,
  FiFileText,
  FiDatabase,
  FiActivity,
  FiX,
} from "react-icons/fi";
import { useMobileNav } from "../../contexts/MobileNavContext";
import useAuth from "../../hooks/useAuth";
import BrandWordmark from "../brand/BrandWordmark";
import "../../styles/sidebar.css";
import "../../styles/brand.css";

export default function BankSidebar() {
  const { closeNav } = useMobileNav();
  const { auth } = useAuth();
  const isAdmin = auth?.user?.role === "BANK_ADMIN";

  const menu = [
    { to: "/bank/dashboard", label: "Dashboard", icon: <FiGrid /> },
    { to: "/bank/files", label: "Uploaded Files", icon: <FiFileText /> },
    { to: "/bank/records", label: "Records", icon: <FiDatabase /> },
    { to: "/bank/tracing", label: "Tracing", icon: <FiActivity /> },
    ...(isAdmin ? [{ to: "/bank/persons", label: "Persons", icon: <FiUsers /> }] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <BrandWordmark className="brand-wordmark--sidebar brand-wordmark--on-dark" />
        </div>
        <button type="button" className="sidebar-close" onClick={closeNav} aria-label="Close menu">
          <FiX aria-hidden />
        </button>
      </div>

      <nav className="sidebar-nav">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeNav}
            className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
          >
            <span className="item-icon">{item.icon}</span>
            <span className="item-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
