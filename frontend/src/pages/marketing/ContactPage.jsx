import { Link } from "react-router-dom";
import { FiPhone, FiMail, FiGlobe, FiMapPin } from "react-icons/fi";
import MarketingPageLayout from "../../components/marketing/MarketingPageLayout";
import { SUPPORT_EMAIL } from "../../constants/brand";
import "../../styles/auth.css";

function ContactRow({ icon, label, value, href }) {
  return (
    <div className="marketing-contact-row">
      <div className="marketing-contact-row__icon">{icon}</div>
      <div>
        <p className="marketing-contact-row__label">{label}</p>
        {href ? (
          <p className="marketing-contact-row__value">
            <a href={href}>{value}</a>
          </p>
        ) : (
          <p className="marketing-contact-row__value">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <MarketingPageLayout narrow>
      <header className="marketing-page__hero">
        <h1 className="marketing-page__title">Contact Us</h1>
        <p className="marketing-page__lead">Get in touch with the Fast Recovery team.</p>
      </header>

      <div className="marketing-panel">
        <div className="marketing-contact-list">
          <ContactRow
            icon={<FiPhone aria-hidden />}
            label="Phone"
            value="9654008400"
            href="tel:+919654008400"
          />
          <ContactRow
            icon={<FiMail aria-hidden />}
            label="Email"
            value={SUPPORT_EMAIL}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
          <ContactRow
            icon={<FiGlobe aria-hidden />}
            label="Website"
            value="www.fastrecovery.in"
            href="https://www.fastrecovery.in"
          />
          <ContactRow icon={<FiMapPin aria-hidden />} label="Location" value="India" />
        </div>
      </div>

      <div className="marketing-callout">
        <p className="marketing-callout__title">Want to purchase Fast Recovery for your agency?</p>
        <p className="marketing-callout__text">
          Call <strong>9654008400</strong> to speak to our team about pricing and onboarding.
        </p>
      </div>

      <div className="marketing-page__actions">
        <Link to="/" className="primary-page-btn">
          ← Back to Login
        </Link>
      </div>
    </MarketingPageLayout>
  );
}
