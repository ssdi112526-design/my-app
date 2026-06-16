import { Link } from "react-router-dom";
import {
  FiUpload,
  FiUsers,
  FiActivity,
  FiShield,
  FiSmartphone,
  FiBell,
} from "react-icons/fi";
import MarketingPageLayout from "../../components/marketing/MarketingPageLayout";
import "../../styles/auth.css";

const SERVICES = [
  {
    icon: <FiUpload size={28} aria-hidden />,
    title: "Bulk Data Upload",
    desc: "Upload Excel files with 400,000+ rows directly to S3. Processed in background with real-time progress.",
  },
  {
    icon: <FiUsers size={28} aria-hidden />,
    title: "Multi-Panel Access",
    desc: "Separate portals for SSDI, Bank Admin, Repo Admin, and Field Tracers — each with the right level of access.",
  },
  {
    icon: <FiActivity size={28} aria-hidden />,
    title: "Live Field Tracking",
    desc: "Real-time GPS tracking of field tracers. Repo admins can see tracer locations on a live map.",
  },
  {
    icon: <FiShield size={28} aria-hidden />,
    title: "Role-Based Security",
    desc: "JWT-secured APIs, data isolation per company and bank, and granular field-level visibility rules.",
  },
  {
    icon: <FiSmartphone size={28} aria-hidden />,
    title: "Mobile App (APK)",
    desc: "Dedicated mobile app for field agents with case assignment, inventory upload and location sharing.",
  },
  {
    icon: <FiBell size={28} aria-hidden />,
    title: "Notifications",
    desc: "In-app, email and WhatsApp notifications for case updates, upload completions, and confirmations.",
  },
];

export default function ServicesPage() {
  return (
    <MarketingPageLayout>
      <header className="marketing-page__hero">
        <h1 className="marketing-page__title">Our Services</h1>
        <p className="marketing-page__lead">End-to-end tools for banks, agencies, and field teams.</p>
      </header>

      <div className="marketing-grid">
        {SERVICES.map((s) => (
          <article key={s.title} className="marketing-card">
            <div className="marketing-card__icon">{s.icon}</div>
            <h2 className="marketing-card__title">{s.title}</h2>
            <p className="marketing-card__text">{s.desc}</p>
          </article>
        ))}
      </div>

      <div className="marketing-page__actions">
        <Link to="/" className="primary-page-btn">
          ← Back to Login
        </Link>
      </div>
    </MarketingPageLayout>
  );
}
