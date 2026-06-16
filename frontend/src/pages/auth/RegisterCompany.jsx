import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import companyService from "../../services/company.service";
import { BANK_NBFC_NAME_LABEL } from "../../constants/companyLabels";
import { REPO_ADMIN_POST_OPTIONS } from "../../constants/repoAdminPost";
import "../../styles/users.css";

const initialForm = {
  companyName: "",
  email: "",
  phone: "",
  address: "",
  contactPersonName: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  adminDistrict: "",
  adminPincode: "",
  adminPost: "",
  adminAgencyName: "",
};

export default function RegisterCompany() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
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

    if (!form.companyName.trim() || !form.adminName.trim() || !form.adminEmail.trim()) {
      setError(`${BANK_NBFC_NAME_LABEL}, admin name, and admin email are required.`);
      return;
    }
    if (!form.adminPassword.trim() || form.adminPassword.length < 8) {
      setError("Admin password must be at least 8 characters.");
      return;
    }
    if (form.adminPhone.replace(/\D/g, "").length < 10) {
      setError("Second confirmation number must be at least 10 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await companyService.registerCompany({
        ...form,
        companyName: form.companyName.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPhone: form.adminPhone.trim(),
      });
      const code =
        res?.data?.company?.companyCode || res?.company?.companyCode || "";
      setSuccess(
        res?.data?.message ||
          res?.message ||
          `Registration submitted${code ? ` (code: ${code})` : ""}. Complete payment offline or online. SSDI will activate your company after payment is confirmed.`
      );
      setForm(initialForm);
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page create-company-page repo-form-page">
      <div className="create-company-header">
        <div>
          <h2>Register your company</h2>
          <p className="muted">
            Submit your company for SSDI review. Payment can be done offline or
            online — SSDI will activate you after payment is confirmed.
          </p>
        </div>
        <Link to="/" className="secondary-page-btn">
          Back to login
        </Link>
      </div>

      <form className="create-company-form" onSubmit={handleSubmit}>
        <div className="create-company-card">
          <h3>Company details</h3>
          <div className="form-grid two-column">
            <div className="form-group">
              <label>{BANK_NBFC_NAME_LABEL} *</label>
              <input name="companyName" value={form.companyName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Company email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>First confirmation number</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label>Address</label>
              <input name="address" value={form.address} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="create-company-card">
          <h3>Repo admin account</h3>
          <div className="form-grid two-column">
            <div className="form-group">
              <label>Admin name *</label>
              <input name="adminName" value={form.adminName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Admin email *</label>
              <input type="email" name="adminEmail" value={form.adminEmail} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Second confirmation number *</label>
              <input name="adminPhone" value={form.adminPhone} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="adminPassword" value={form.adminPassword} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>District</label>
              <input name="adminDistrict" value={form.adminDistrict} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input name="adminPincode" value={form.adminPincode} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Post</label>
              <select name="adminPost" value={form.adminPost} onChange={handleChange}>
                <option value="">Select post</option>
                {REPO_ADMIN_POST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Agency name</label>
              <input name="adminAgencyName" value={form.adminAgencyName} onChange={handleChange} />
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="cfm-status">{success}</p>}

        <div className="create-company-actions">
          <button type="button" className="secondary-page-btn" onClick={() => navigate("/repo-admin/login")}>
            Go to repo admin login
          </button>
          <button type="submit" className="primary-page-btn" disabled={loading}>
            {loading ? "Submitting…" : "Submit registration"}
          </button>
        </div>
      </form>
    </div>
  );
}
