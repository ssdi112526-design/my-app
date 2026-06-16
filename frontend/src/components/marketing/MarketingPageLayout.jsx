import PublicLoginHeader from "../auth/PublicLoginHeader";
import "../../styles/marketing.css";

/**
 * Shell for /products, /faqs, etc. — header + responsive content (footer from PublicPageShell).
 */
export default function MarketingPageLayout({ children, narrow = false }) {
  return (
    <div className="marketing-page">
      <PublicLoginHeader />
      <main className="marketing-page__main">
        <div
          className={`marketing-page__inner${narrow ? " marketing-page__inner--narrow" : ""}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
