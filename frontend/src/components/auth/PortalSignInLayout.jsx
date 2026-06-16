import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import PublicLoginHeader from "./PublicLoginHeader";
import BrandWordmark from "../brand/BrandWordmark";
import "../../styles/publicLogin.css";

/**
 * Tata-style sign-in page: corporate header, breadcrumb, hero left + card right.
 */
export default function PortalSignInLayout({
  breadcrumb = [],
  title,
  subtitle,
  perks = [],
  cardTitle = "SIGN-IN USING :",
  children,
}) {
  return (
    <div className="portal-signin-page">
      <PublicLoginHeader />

      <div className="portal-signin-breadcrumb">
        <div className="portal-signin-breadcrumb__inner">
          <Link to="/">Home</Link>
          {breadcrumb.map((crumb) => (
            <span key={crumb.label}>
              <span className="portal-signin-breadcrumb__sep"> - </span>
              {crumb.to ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="portal-signin-body">
        <div className="portal-signin-body__inner">
          <section className="portal-signin-hero">
            <Link to="/" className="portal-signin-back">
              <FiArrowLeft aria-hidden />
              Back to home
            </Link>

            <div className="login-brand-lockup portal-signin-brand-lockup">
              <div className="login-brand-icon" aria-hidden>
                FR
              </div>
            </div>

            <BrandWordmark className="brand-wordmark--md" as="h1" />

            {title && <h2 className="portal-signin-hero__title">{title}</h2>}
            {subtitle && <p className="portal-signin-hero__text">{subtitle}</p>}

            {perks.length > 0 && (
              <ul className="auth-login-perks">
                {perks.map((item) => (
                  <li key={item}>
                    <span className="login-portal-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="portal-signin-card">
            {cardTitle && <p className="portal-signin-card__eyebrow">{cardTitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
