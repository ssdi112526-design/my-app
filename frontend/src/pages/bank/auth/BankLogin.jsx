import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import bankService from "../../../services/bank.service";
import { useAuthContext } from "../../../context/AuthContext";
import PortalSignInLayout from "../../../components/auth/PortalSignInLayout";
import "../../../styles/auth.css";

export default function BankLogin() {
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [form, setForm] = useState({
    bankId: "",
    roleType: "admin",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await bankService.listPublicBanks();
        const list = res?.data?.data?.banks || [];
        if (!cancelled) {
          setBanks(list);
          if (list.length === 1) {
            setForm((p) => ({ ...p, bankId: String(list[0]._id) }));
          }
        }
      } catch {
        if (!cancelled) setError("Could not load banks. Please refresh and try again.");
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.bankId) {
      setError("Please select your bank.");
      return;
    }

    setLoading(true);
    try {
      const res = await bankService.login({
        email: form.email,
        password: form.password,
      });
      const { token, user } = res.data.data;

      const selectedBankId = String(form.bankId);
      const userBankId = String(user.bankId || user.bank?.id || "");

      if (userBankId !== selectedBankId) {
        setError("This account is not registered with the selected bank.");
        return;
      }

      if (form.roleType === "admin" && user.role !== "BANK_ADMIN") {
        setError("Please choose Bank Admin and sign in with your admin credentials.");
        return;
      }

      if (form.roleType === "user" && user.role !== "BANK_PERSON") {
        setError("Please choose Bank User and sign in with your bank person credentials.");
        return;
      }

      login({ token, user });
      navigate("/bank/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalSignInLayout
      breadcrumb={[{ label: "Bank / Financer Login" }]}
      title="Bank & financer portal"
      subtitle="Sign in with the bank you are connected to. Bank admins manage users and uploads; bank users work on assigned records."
      perks={[
        "Select your financer before signing in",
        "Separate admin and bank user access",
        "Same credentials as provided by your bank admin",
      ]}
    >
      <form onSubmit={handleSubmit} className="portal-signin-form">
        <div className="portal-signin-role-group" role="radiogroup" aria-label="Sign in as">
          <label>
            <input
              type="radio"
              name="roleType"
              value="admin"
              checked={form.roleType === "admin"}
              onChange={handleChange}
            />
            BANK ADMIN
          </label>
          <label>
            <input
              type="radio"
              name="roleType"
              value="user"
              checked={form.roleType === "user"}
              onChange={handleChange}
            />
            BANK USER
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="bankId">Select bank</label>
          <select
            id="bankId"
            name="bankId"
            value={form.bankId}
            onChange={handleChange}
            required
            disabled={banksLoading}
          >
            <option value="">
              {banksLoading ? "Loading banks…" : "Choose your bank"}
            </option>
            {banks.map((b) => (
              <option key={b._id} value={String(b._id)}>
                {b.bankName}
                {b.bankCode ? ` (${b.bankCode})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
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
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="portal-signin-submit" disabled={loading || banksLoading}>
          {loading ? "Signing in…" : "Login"}
        </button>

        <div className="portal-signin-links">
          <p>
            New bank? <Link to="/bank/register">Register here</Link>
          </p>
        </div>
      </form>
    </PortalSignInLayout>
  );
}
