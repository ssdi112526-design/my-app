import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/auth.service";
import useAuth from "../../hooks/useAuth";
import { getApiErrorMessage } from "../../utils/apiErrorMessage";
import { DEFAULT_LANDING_PATH } from "../../utils/navReturn";
import PortalSignInLayout from "../../components/auth/PortalSignInLayout";
import "../../styles/auth.css";

export default function RepoAdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const data = await authService.repoAdminLogin(form);

      if (!data?.user || !data?.token) {
        throw new Error("Invalid login response");
      }

      if (data.user.role !== "REPO_ADMIN") {
        throw new Error("Only repo admin can login here.");
      }

      login({
        user: data.user,
        token: data.token,
      });

      navigate(DEFAULT_LANDING_PATH, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Repo admin login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalSignInLayout
      breadcrumb={[{ label: "Repo Company Admin Login" }]}
      title="Repo company admin"
      subtitle="Manage your recovery company — staff, assignments, reports, and daily operations from one secure workspace."
      perks={["Company operations", "Staff and assignments", "Reports and records"]}
    >
      <form onSubmit={handleSubmit} className="portal-signin-form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="Repo admin email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className="auth-message error">{error}</p>}

        <button type="submit" className="portal-signin-submit" disabled={loading}>
          {loading ? "Please wait…" : "Login"}
        </button>

        <div className="portal-signin-links">
          <p>
            <Link to="/register">New company? Register via APK</Link>
          </p>
          <p>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </div>
      </form>
    </PortalSignInLayout>
  );
}
