import { Link } from "react-router-dom";
import MarketingPageLayout from "../../components/marketing/MarketingPageLayout";
import { SUPPORT_EMAIL } from "../../constants/brand";
import "../../styles/auth.css";

export default function AboutPage() {
  return (
    <MarketingPageLayout narrow>
      <header className="marketing-page__hero">
        <h1 className="marketing-page__title">About Us</h1>
        <p className="marketing-page__lead">Software Solution Development India (SSDI)</p>
      </header>

      <div className="marketing-panel">
        <h2>Who We Are</h2>
        <p>
          Software Solution Development India (SSDI) is the company behind Fast Recovery —
          a platform designed specifically for India&apos;s loan repossession industry.
        </p>
        <p>
          We build technology that connects banks, repossession agencies, and field tracers in a
          single, secure ecosystem — reducing paperwork, improving visibility, and speeding up the
          recovery process.
        </p>
        <h2>Our Mission</h2>
        <p>
          To digitise and streamline loan recovery operations across India — giving every party in
          the chain real-time information, accountability, and control.
        </p>
        <h2>Contact</h2>
        <p>
          Phone: <a href="tel:+919654008400">9654008400</a>
        </p>
        <p>
          Website:{" "}
          <a href="https://www.fastrecovery.in" target="_blank" rel="noopener noreferrer">
            www.fastrecovery.in
          </a>
        </p>
        <p>
          Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
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
