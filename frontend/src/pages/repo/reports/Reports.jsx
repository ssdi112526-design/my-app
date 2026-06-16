import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiList,
  FiMapPin,
  FiNavigation,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { withReturnPath } from "../../../utils/navReturn";
import "../../../styles/reports.css";

const ADMIN_REPORT_CARDS = [
  {
    to: "/cases",
    title: "All Trace Cases",
    desc: "Every traced vehicle with status, field user, role and reported time.",
    icon: FiList,
    accent: "blue",
  },
  {
    to: "/users",
    title: "All Team",
    desc: "Team members, roles, assigned vehicles and active or blocked status.",
    icon: FiUsers,
    accent: "violet",
  },
  {
    to: "/field-map",
    title: "GPS Report",
    desc: "Live field map with tracer locations and last known GPS for each case.",
    icon: FiMapPin,
    accent: "green",
  },
  {
    to: withReturnPath("/confirmation?status=CONFIRMED", "/home"),
    title: "Confirmed Cases",
    desc: "Admin-confirmed traces only — vehicle, bank, tracer and inventory status.",
    icon: FiCheckCircle,
    accent: "amber",
  },
];

const VIEWER_REPORT_CARDS = [
  {
    to: "/find-vehicles",
    title: "Vehicle Search",
    desc: "Search uploaded records by vehicle, customer, loan account or bank.",
    icon: FiSearch,
    accent: "blue",
  },
  {
    to: "/live-tracking",
    title: "Live Tracking",
    desc: "Device permission and GPS status for field staff in the field.",
    icon: FiNavigation,
    accent: "green",
  },
  {
    to: withReturnPath("/confirmation?status=CONFIRMED", "/reports"),
    title: "Confirmed Traces",
    desc: "View confirmed vehicle traces and submitted inventory files.",
    icon: FiCheckCircle,
    accent: "amber",
  },
  {
    to: withReturnPath("/confirmation", "/reports"),
    title: "All Confirmations",
    desc: "Browse every trace confirmation submitted by the field team.",
    icon: FiList,
    accent: "violet",
  },
];

export default function Reports() {
  const { auth } = useAuth();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const cards = isRepoAdmin ? ADMIN_REPORT_CARDS : VIEWER_REPORT_CARDS;

  return (
    <div className="content reports-page">
      <header className="reports-head">
        <h1>Reports</h1>
      </header>

      <div className="reports-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              to={card.to}
              className={`reports-card reports-card--${card.accent}`}
            >
              <span className="reports-card__icon" aria-hidden>
                <Icon />
              </span>
              <div className="reports-card__body">
                <h2>{card.title}</h2>
                <p>{card.desc}</p>
              </div>
              <span className="reports-card__arrow" aria-hidden>
                <FiArrowRight />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
