import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bankService from "../../../services/bank.service";
import "../../../styles/users.css";

const initial = {
  bankName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  gstNumber: "",
  panNumber: "",
  branchName: "",
  adminName: "",
  adminPassword: "",
  adminBranchName: "",
  adminEmployeeNumber: "",
  status: "pending_payment",
};

export default function SsdiCreateBank() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const upperFields = new Set(["gstNumber", "panNumber"]);
    setForm((p) => ({
      ...p,
      [name]: upperFields.has(name) ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.adminPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await bankService.ssdiCreateBank(form);
      const data = res?.data?.data;
      setCreds({
        email: data?.admin?.email,
        password: form.adminPassword,
        bankCode: data?.bank?.bankCode,
      });
      setForm(initial);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create bank");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initial);
    setError("");
  };

  return (
    <div className="page create-company-page repo-form-page ssdi-create-bank-page">
      <div className="create-company-header">
        <div>
          <h2>Create Bank</h2>
        </div>
        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/ssdi/banks")}
        >
          Back to Banks
        </button>
      </div>

      {creds && (
        <div className="created-credentials-card ssdi-create-bank-credentials">
          <h3>Bank Created — Login Credentials</h3>
          <p>
            <strong>Bank Code:</strong> {creds.bankCode}
          </p>
          <p>
            <strong>Email:</strong> {creds.email}
          </p>
          <p>
            <strong>Password:</strong> {creds.password}
          </p>
          <button
            type="button"
            className="primary-page-btn"
            onClick={() => navigate("/ssdi/banks")}
          >
            Back to Banks List
          </button>
        </div>
      )}

      <form className="create-company-form" onSubmit={handleSubmit}>
        <div className="create-company-card">
          <section
            className="create-company-section"
            aria-labelledby="ssdi-bank-section-details"
          >
            <header
              className="create-company-section__head"
              id="ssdi-bank-section-details"
            >
              <h3>Bank details</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group">
                <label htmlFor="bankName">Bank Name *</label>
                <input
                  id="bankName"
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  required
                  placeholder="Bank name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="pending_payment">Pending Payment</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="Bank email"
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone *</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="Phone number"
                  autoComplete="tel"
                />
              </div>
              <div className="form-group">
                <label htmlFor="gstNumber">GST Number</label>
                <input
                  id="gstNumber"
                  name="gstNumber"
                  value={form.gstNumber}
                  onChange={handleChange}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  maxLength={15}
                  autoCapitalize="characters"
                />
              </div>
              <div className="form-group">
                <label htmlFor="panNumber">PAN Number</label>
                <input
                  id="panNumber"
                  name="panNumber"
                  value={form.panNumber}
                  onChange={handleChange}
                  placeholder="e.g. AAAAA9999A"
                  maxLength={10}
                  autoCapitalize="characters"
                />
              </div>
              <div className="form-group">
                <label htmlFor="branchName">Branch</label>
                <input
                  id="branchName"
                  name="branchName"
                  value={form.branchName}
                  onChange={handleChange}
                  placeholder="Head office / primary branch"
                />
              </div>
            </div>
          </section>

          <section
            className="create-company-section"
            aria-labelledby="ssdi-bank-section-location"
          >
            <header
              className="create-company-section__head"
              id="ssdi-bank-section-location"
            >
              <h3>Location</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>
              <div className="form-group">
                <label htmlFor="state">State</label>
                <input
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Bank address"
                />
              </div>
            </div>
          </section>

          <section
            className="create-company-section create-company-section--last"
            aria-labelledby="ssdi-bank-section-admin"
          >
            <header
              className="create-company-section__head"
              id="ssdi-bank-section-admin"
            >
              <h3>Bank admin account</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group">
                <label htmlFor="adminName">Admin Name *</label>
                <input
                  id="adminName"
                  name="adminName"
                  value={form.adminName}
                  onChange={handleChange}
                  required
                  placeholder="Bank admin full name"
                  autoComplete="name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminPassword">Admin Password * (min 8)</label>
                <input
                  id="adminPassword"
                  type="password"
                  name="adminPassword"
                  value={form.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  placeholder="Create password"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminBranchName">Admin branch</label>
                <input
                  id="adminBranchName"
                  name="adminBranchName"
                  value={form.adminBranchName}
                  onChange={handleChange}
                  placeholder={form.branchName || "Branch for bank admin"}
                />
              </div>
              <div className="form-group">
                <label htmlFor="adminEmployeeNumber">Admin employee number</label>
                <input
                  id="adminEmployeeNumber"
                  name="adminEmployeeNumber"
                  value={form.adminEmployeeNumber}
                  onChange={handleChange}
                  placeholder="Employee / staff ID"
                />
              </div>
            </div>
          </section>
        </div>

        {error && <p className="error-text create-company-error">{error}</p>}

        <div className="create-company-actions create-company-actions--sticky">
          <button
            type="button"
            className="secondary-page-btn"
            onClick={resetForm}
            disabled={loading}
          >
            Reset
          </button>
          <button
            type="submit"
            className="primary-page-btn"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Bank"}
          </button>
        </div>
      </form>
    </div>
  );
}
