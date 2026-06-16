import { useNavigate } from "react-router-dom";
import PublicLoginHeader from "../../components/auth/PublicLoginHeader";
import StoreBadges from "../../components/marketing/StoreBadges";
import { BRAND_NAME } from "../../constants/brand";
import "../../styles/auth.css";
import "../../styles/publicLogin.css";

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="public-login-page">
      <PublicLoginHeader />
      <div className="auth-container login-portal-container public-login-landing public-login-landing--hero">
        <div className="login-portal-shape login-portal-shape-one" aria-hidden />
        <div className="login-portal-shape login-portal-shape-two" aria-hidden />
        <div className="login-portal-grid-bg" aria-hidden />

        <div className="login-portal-layout login-portal-layout--hero-only">
          <div className="login-portal-content">
            <div className="login-brand-lockup">
              <div className="login-brand-icon" aria-hidden>
                FR
              </div>
            </div>

            <h1 className="login-brand-wordmark" aria-label={BRAND_NAME}>
              <span className="login-brand-fast">Fast</span>
              <span className="login-brand-recovery">Recovery</span>
            </h1>

            <p className="login-portal-subtitle">
              One platform for recovery teams — use the Login menu above to sign
              in to your workspace.
            </p>

            <div className="login-portal-highlights">
              {[
                "Multi-tenant companies",
                "Role-based secure access",
                "Real-time operations",
              ].map((text, i) => (
                <div
                  key={text}
                  className="login-portal-highlight"
                  style={{ animationDelay: `${i * 0.12}s` }}
                >
                  <span className="login-portal-dot" />
                  {text}
                </div>
              ))}
            </div>

            <StoreBadges
              className="login-store-badges"
              title="Get the Fast Recovery app"
              variant="dark"
            />

            <p className="auth-link login-portal-register-hint login-portal-register-hint--inline">
              <span onClick={() => navigate("/register")}>
                New here? Register company or join as agent (APK)
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
