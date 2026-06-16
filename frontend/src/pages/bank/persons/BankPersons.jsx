import { useEffect, useState } from "react";
import { FiPlus, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import bankService from "../../../services/bank.service";
import "../../../styles/users.css";

const initial = {
  name: "",
  email: "",
  phone: "",
  password: "",
  branchName: "",
  employeeNumber: "",
};

export default function BankPersons() {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await bankService.getPersons();
      setPersons(res?.data?.data?.persons || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await bankService.createPerson(form);
      setForm(initial);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create person");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await bankService.togglePerson(id);
      await load();
    } catch {/* silent */}
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2>Bank Persons</h2>
        <button className="primary-page-btn" onClick={() => setShowForm((s) => !s)}>
          <FiPlus /> {showForm ? "Cancel" : "Add Person"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>New Bank Person</h3>
          <div className="form-grid two-column">
            <div className="form-group">
              <label>Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required placeholder="Full name" />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="Email" />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="Phone number" />
            </div>
            <div className="form-group">
              <label>Password * (min 8)</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={8} placeholder="Password" autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label>Branch</label>
              <input name="branchName" value={form.branchName} onChange={handleChange} placeholder="Branch name" />
            </div>
            <div className="form-group">
              <label>Employee number</label>
              <input name="employeeNumber" value={form.employeeNumber} onChange={handleChange} placeholder="Employee / staff ID" />
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-page-btn" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? "Creating..." : "Create Person"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : persons.length === 0 ? (
        <p className="muted">No persons added yet.</p>
      ) : (
        <div className="users-list">
          {persons.map((p) => (
            <div key={p._id} className="user-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "var(--card-bg,#fff)", border: "1px solid var(--border,#e5e7eb)", borderRadius: 8, marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 600 }}>{p.name}</p>
                <p className="muted" style={{ fontSize: 13 }}>
                  {p.email} &nbsp;·&nbsp; {p.phone}
                  {(p.branchName || p.employeeNumber) && (
                    <>
                      <br />
                      {p.branchName ? `Branch: ${p.branchName}` : ""}
                      {p.branchName && p.employeeNumber ? " · " : ""}
                      {p.employeeNumber ? `Emp# ${p.employeeNumber}` : ""}
                    </>
                  )}
                </p>
                <p style={{ fontSize: 12, marginTop: 4, color: p.isActive ? "green" : "red" }}>
                  {p.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <button
                className="secondary-page-btn"
                onClick={() => handleToggle(p._id)}
                title={p.isActive ? "Deactivate" : "Activate"}
              >
                {p.isActive ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
                {p.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
