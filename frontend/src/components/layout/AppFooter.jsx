import { Link } from "react-router-dom";
import { FiMail, FiPhone, FiExternalLink } from "react-icons/fi";
import BrandWordmark from "../brand/BrandWordmark";
import StoreBadges from "../marketing/StoreBadges";
import { COMPANY_LEGAL_NAME, SUPPORT_EMAIL } from "../../constants/brand";
import { LOGIN_PORTAL_OPTIONS } from "../../constants/loginPortals";
import { PUBLIC_NAV_LINKS } from "../../constants/publicNavLinks";
import "../../styles/brand.css";
import "../../styles/footer.css";

const REGISTER_LINK = { label: "Register", to: "/register" };

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-main">
        <div className="app-footer-inner app-footer-grid">
          <div className="app-footer-brand-col">
            <Link to="/" className="app-footer-brand-lockup">
              <span className="app-footer-logo-icon" aria-hidden>
                FR
              </span>
              <BrandWordmark className="brand-wordmark--on-dark brand-wordmark--header" />
            </Link>
            <p className="app-footer-tagline">
              One platform for recovery teams — secure, role-based access for banks,
              repo companies, and field operations.
            </p>
            <div className="app-footer-contact-chips">
              <a href="tel:+919654008400" className="app-footer-chip">
                <FiPhone aria-hidden />
                9654008400
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer-chip">
                <FiMail aria-hidden />
                {SUPPORT_EMAIL}
              </a>
            </div>
            <StoreBadges
              className="store-badges--footer"
              title="Download our app"
              variant="light"
            />
          </div>

          <div className="app-footer-col">
            <h3 className="app-footer-col-title">Quick Links</h3>
            <ul className="app-footer-links">
              {PUBLIC_NAV_LINKS.map((item) => (
                <li key={item.to} className="app-footer-quicklink--public">
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
              <li>
                <Link to={REGISTER_LINK.to}>{REGISTER_LINK.label}</Link>
              </li>
            </ul>
          </div>

          <div className="app-footer-col">
            <h3 className="app-footer-col-title">Sign In</h3>
            <ul className="app-footer-links">
              {LOGIN_PORTAL_OPTIONS.filter((p) => p.id !== "register").map((item) => (
                <li key={item.id}>
                  <Link to={item.route}>
                    {item.label}
                    <FiExternalLink className="app-footer-link-icon" aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/register">
                  Register company / agent
                  <FiExternalLink className="app-footer-link-icon" aria-hidden />
                </Link>
              </li>
            </ul>
          </div>

          <div className="app-footer-col">
            <h3 className="app-footer-col-title">Company</h3>
            <ul className="app-footer-links">
              <li>
                <span className="app-footer-company-name">{COMPANY_LEGAL_NAME}</span>
              </li>
              <li>
                <a
                  href="https://www.fastrecovery.in"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.fastrecovery.in
                  <FiExternalLink className="app-footer-link-icon" aria-hidden />
                </a>
              </li>
            </ul>
            <p className="app-footer-purchase">
              For purchase &amp; enquiries:{" "}
              <a href="tel:+919654008400">9654008400</a>
            </p>
          </div>
        </div>
      </div>

      <div className="app-footer-bottom">
        <div className="app-footer-inner app-footer-bottom-inner">
          <p>
            © {year} {COMPANY_LEGAL_NAME}. All rights reserved.
          </p>
          <p className="app-footer-bottom-note">Powered by Fast Recovery</p>
        </div>
      </div>
    </footer>
  );
}
