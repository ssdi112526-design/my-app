import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authService } from "../../services/auth.service";
import { REPO_ROLE_OPTIONS } from "../../constants/repoRoles";
import "../../styles/auth.css";
import "../../styles/users.css";

export default function AgentRegister() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    companyCode: searchParams.get("code") || "",
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "REPO_STAFF",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.companyCode.trim() || !form.name.trim() || !form.email.trim()) {
      setError("Company code, name, and email are required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.agentSelfRegister({
        ...form,
        companyCode: form.companyCode.trim().toUpperCase(),
        name: form.name.trim(),
        email: form.email.trim(),
      });
      setSuccess(
        res?.data?.message ||
          res?.message ||
          "Registration submitted. Your repo admin will activate your account."
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: 520, width: "100%" }}>
        <h2>Agent self-registration</h2>
        <p className="muted">
          Register with your company code from the repo admin. Your account stays
          inactive until the admin activates it.
        </p>

        <form onSubmit={handleSubmit} className="create-company-form" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>Company code *</label>
            <input
              name="companyCode"
              value={form.companyCode}
              onChange={handleChange}
              placeholder="e.g. HIM1114"
              required
            />
          </div>
          <div className="form-group">
            <label>Full name *</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Mobile *</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="REPO_STAFF">Repo Staff</option>
              {REPO_ROLE_OPTIONS.filter((r) => r.value !== "REPO_STAFF").map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="cfm-status">{success}</p>}

          <div className="create-company-actions">
            <Link to="/repo-agent/login" className="secondary-page-btn">
              Back to login
            </Link>
            <button type="submit" className="primary-page-btn" disabled={loading}>
              {loading ? "Submitting…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
