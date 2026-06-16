import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import bankService from "../../../services/bank.service";
import "../../../styles/auth.css";
import "../../../styles/users.css";

const initial = {
  bankName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  adminName: "",
  adminPassword: "",
};

export default function BankRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.adminPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await bankService.register(form);
      setSuccess(
        "Registration submitted! SSDI will review and activate your account after payment."
      );
      setForm(initial);
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="create-company-card" style={{ maxWidth: 600, margin: "40px auto", padding: 32 }}>
        <h2 style={{ marginBottom: 24 }}>Register Your Bank</h2>

        {success ? (
          <div>
            <p style={{ color: "green", marginBottom: 16 }}>{success}</p>
            <Link to="/bank/login" className="primary-page-btn">
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-grid two-column">
              <div className="form-group">
                <label>Bank Name *</label>
                <input name="bankName" value={form.bankName} onChange={handleChange} required placeholder="Enter bank name" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="Bank email" />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="10-digit number" />
              </div>
              <div className="form-group">
                <label>City</label>
                <input name="city" value={form.city} onChange={handleChange} placeholder="City" />
              </div>
              <div className="form-group">
                <label>State</label>
                <input name="state" value={form.state} onChange={handleChange} placeholder="State" />
              </div>
              <div className="form-group full-width">
                <label>Address</label>
                <input name="address" value={form.address} onChange={handleChange} placeholder="Bank address" />
              </div>
              <div className="form-group">
                <label>Admin Name *</label>
                <input name="adminName" value={form.adminName} onChange={handleChange} required placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label>Password * (min 8 chars)</label>
                <input
                  type="password"
                  name="adminPassword"
                  value={form.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button type="submit" className="primary-page-btn" disabled={loading}>
                {loading ? "Submitting..." : "Submit Registration"}
              </button>
              <Link to="/bank/login" className="secondary-page-btn">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
