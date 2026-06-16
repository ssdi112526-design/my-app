import { Link } from "react-router-dom";
import MarketingPageLayout from "../../components/marketing/MarketingPageLayout";
import "../../styles/auth.css";

const products = [
  {
    title: "Repo Admin Panel",
    description:
      "Full-featured dashboard for repossession agencies. Manage cases, tracers, uploads, confirmations and finances in one place.",
    badge: "Agency",
  },
  {
    title: "Bank Panel",
    description:
      "Upload recovery data, connect with agencies, and track the status of every record — who is working it and what the outcome is.",
    badge: "Bank",
  },
  {
    title: "Tracer / Field App",
    description:
      "Mobile-optimised field portal for tracers. Get assigned cases, update status, upload inventory photos and share location.",
    badge: "Field",
  },
  {
    title: "SSDI Control Panel",
    description:
      "Platform administration — manage companies, subscriptions, payments, and connect banks with agencies.",
    badge: "Admin",
  },
];

export default function ProductsPage() {
  return (
    <MarketingPageLayout>
      <header className="marketing-page__hero">
        <h1 className="marketing-page__title">Our Products</h1>
        <p className="marketing-page__lead">
          Fast Recovery is a multi-panel platform built for the loan recovery ecosystem in India.
        </p>
      </header>

      <div className="marketing-grid">
        {products.map((p) => (
          <article key={p.title} className="marketing-card">
            <span className="marketing-card__badge">{p.badge}</span>
            <h2 className="marketing-card__title">{p.title}</h2>
            <p className="marketing-card__text">{p.description}</p>
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
