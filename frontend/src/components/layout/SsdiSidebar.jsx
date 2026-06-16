import { NavLink } from "react-router-dom";
import {
  FiGrid,
  FiBriefcase,
  FiLayers,
  FiCreditCard,
  FiUserPlus,
  FiUserX,
  FiMessageCircle,
  FiX,
  FiHome,
} from "react-icons/fi";
import { useMobileNav } from "../../contexts/MobileNavContext";
import BrandWordmark from "../brand/BrandWordmark";
import "../../styles/sidebar.css";
import "../../styles/brand.css";

export default function SsdiSidebar() {
  const { closeNav } = useMobileNav();
  const menu = [
    { to: "/ssdi/dashboard", label: "Dashboard", icon: <FiGrid /> },
    { to: "/ssdi/companies", label: "Companies", icon: <FiBriefcase /> },
    { to: "/ssdi/registrations", label: "Registrations", icon: <FiUserPlus /> },
    { to: "/ssdi/plans", label: "Plans", icon: <FiLayers /> },
    { to: "/ssdi/payments", label: "Payments", icon: <FiCreditCard /> },
    { to: "/ssdi/blacklist", label: "Blacklist", icon: <FiUserX /> },
    { to: "/ssdi/feedbacks", label: "Feedbacks", icon: <FiMessageCircle /> },
    { to: "/ssdi/banks", label: "Banks", icon: <FiHome /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <BrandWordmark className="brand-wordmark--sidebar brand-wordmark--on-dark" />
        </div>
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
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/ssdi/companies"}
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
    </aside>
  );
}