import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiLock, FiMail } from "react-icons/fi";
import { authService } from "../../services/auth.service";
import useAuth from "../../hooks/useAuth";
import { getApiErrorMessage } from "../../utils/apiErrorMessage";
import PublicLoginHeader from "../../components/auth/PublicLoginHeader";
import BrandWordmark from "../../components/brand/BrandWordmark";
import "../../styles/auth.css";
import "../../styles/brand.css";
import "../../styles/publicLogin.css";

export default function SsdiLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await authService.ssdiLogin(form);

      if (!data?.user || !data?.token) {
        throw new Error("Invalid login response");
      }

      if (data.user.role !== "SSDI_SUPER_ADMIN") {
        throw new Error("Only platform admin can sign in here.");
      }

      login({
        user: data.user,
        token: data.token,
      });

      navigate("/ssdi/dashboard", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Admin login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-login-page">
      <PublicLoginHeader />
    <div className="auth-container login-portal-container auth-login-page auth-login-page--with-header">
      <div className="login-portal-shape login-portal-shape-one" aria-hidden />
      <div className="login-portal-shape login-portal-shape-two" aria-hidden />
      <div className="login-portal-grid-bg" aria-hidden />

      <div className="auth-login-shell">
        <section className="auth-login-aside">
          <button
            type="button"
            className="auth-back-link"
            onClick={() => navigate("/")}
          >
            <FiArrowLeft aria-hidden />
            Back to portal
          </button>

          <div className="login-brand-lockup">
            <div className="login-brand-icon" aria-hidden>
              FR
            </div>
          </div>

          <BrandWordmark className="brand-wordmark--lg" as="h1" />

          <p className="auth-login-aside-text">
            Platform owner access — manage companies, plans, billing, and
            platform-wide settings from one secure workspace.
          </p>

          <ul className="auth-login-perks">
            {["Companies and plans", "Payments overview", "Blacklist control"].map(
              (item) => (
                <li key={item}>
                  <span className="login-portal-dot" />
                  {item}
                </li>
              )
            )}
          </ul>
        </section>

        <form
          className={`auth-box auth-login-form${loading ? " is-submitting" : ""}`}
          onSubmit={handleSubmit}
        >
          <h2>Admin sign in</h2>
          <p className="auth-info">Use your platform admin credentials.</p>

          <label
            className={`auth-field${focusedField === "email" ? " is-focused" : ""}${
              form.email ? " has-value" : ""
            }`}
          >
            <span className="auth-field-label">
              <FiMail aria-hidden />
              Email
            </span>
            <input
              type="email"
              name="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoComplete="email"
              required
            />
          </label>

          <label
            className={`auth-field${focusedField === "password" ? " is-focused" : ""}${
              form.password ? " has-value" : ""
            }`}
          >
            <span className="auth-field-label">
              <FiLock aria-hidden />
              Password
            </span>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            className="auth-button secondary auth-login-submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in to Admin"}
          </button>

          {error && <p className="auth-message error">{error}</p>}
        </form>
      </div>
    </div>
    </div>
  );
}
