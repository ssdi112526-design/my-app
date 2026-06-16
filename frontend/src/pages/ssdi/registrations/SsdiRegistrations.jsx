import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCheckCircle,
  FiCreditCard,
  FiEye,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import { formatRepoRole } from "../../../constants/repoRoles";
import "../../../styles/users.css";

export default function SsdiRegistrations() {
  const { auth } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionIds, setActionIds] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");
      const res = await companyService.getPendingRegistrations(auth.token);
      setCompanies(res?.data?.companies || res?.companies || []);
      setUsers(res?.data?.users || res?.users || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load registrations");
      setCompanies([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const withAction = async (id, fn) => {
    setActionIds((prev) => new Set(prev).add(id));
    try {
      await fn();
      await load();
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMarkPayment = async (company, method) => {
    const companyId = company._id || company.id;
    const note = window.prompt(
      `Payment note for ${company.companyName} (${method.toLowerCase()}):`,
      ""
    );
    if (note === null) return;

    await withAction(companyId, async () => {
      try {
        await companyService.markCompanyPayment(
          companyId,
          { paymentMethod: method, paymentNote: note },
          auth.token
        );
      } catch (err) {
        alert(err?.response?.data?.message || "Failed to mark payment");
        throw err;
      }
    });
  };

  const handleApprove = async (company) => {
    const companyId = company._id || company.id;
    if (!window.confirm(`Approve and activate ${company.companyName}?`)) return;

    await withAction(companyId, async () => {
      try {
        await companyService.approveCompany(companyId, auth.token);
      } catch (err) {
        alert(err?.response?.data?.message || "Failed to approve company");
        throw err;
      }
    });
  };

  const handleActivateUser = async (user) => {
    const userId = user._id || user.id;
    const companyId =
      user.companyId?._id || user.companyId?.id || user.companyId;
    if (!companyId) {
      alert("Company not found for this user.");
      return;
    }
    if (!window.confirm(`Activate ${user.name}?`)) return;

    await withAction(userId, async () => {
      try {
        await companyService.updateCompanyUserStatus(
          companyId,
          userId,
          true,
          auth.token
        );
      } catch (err) {
        alert(err?.response?.data?.message || "Failed to activate user");
        throw err;
      }
    });
  };

  return (
    <div className="page companies-page">
      <div className="create-company-header">
        <div>
          <h2>Pending registrations</h2>
          <p className="muted">
            APK self-registrations. Mark payment received (offline or online), then
            approve companies. Activate self-registered users after review.
          </p>
        </div>
        <button type="button" className="secondary-page-btn" onClick={load} disabled={loading}>
          <FiRefreshCw aria-hidden />
          Refresh
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="create-company-card" style={{ marginBottom: 24 }}>
        <h3>Pending companies ({companies.length})</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : companies.length === 0 ? (
          <p className="muted">No pending company registrations.</p>
        ) : (
          <div className="company-table-wrap">
            <table className="users-table excel-grid-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Company</th>
                  <th>Admin</th>
                  <th>Source</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const companyId = company._id || company.id;
                  const busy = actionIds.has(companyId);
                  const unpaid = company.paymentStatus !== "PAID";

                  return (
                    <tr key={companyId}>
                      <td>{company.companyCode || "—"}</td>
                      <td>{company.companyName || "—"}</td>
                      <td>
                        {company.repoAdminUserId?.name || "—"}
                        <br />
                        <span className="muted">{company.repoAdminUserId?.email || ""}</span>
                      </td>
                      <td>{company.registrationSource === "SELF" ? "APK / Self" : "SSDI"}</td>
                      <td>
                        <span
                          className={`company-status ${
                            unpaid ? "company-status--pending" : "company-status--active"
                          }`}
                        >
                          {company.paymentStatus || "UNPAID"}
                        </span>
                        {company.paymentMethod && (
                          <span className="field-hint"> ({company.paymentMethod})</span>
                        )}
                      </td>
                      <td className="company-actions-td">
                        <div className="company-actions-cell">
                          <Link
                            to={`/ssdi/companies/${companyId}`}
                            className="company-btn company-btn--view"
                          >
                            <FiEye aria-hidden />
                            <span>View</span>
                          </Link>
                          {unpaid && (
                            <>
                              <button
                                type="button"
                                className="company-btn company-btn--reset"
                                disabled={busy}
                                onClick={() => handleMarkPayment(company, "OFFLINE")}
                              >
                                <FiCreditCard aria-hidden />
                                <span>Offline paid</span>
                              </button>
                              <button
                                type="button"
                                className="company-btn company-btn--reset"
                                disabled={busy}
                                onClick={() => handleMarkPayment(company, "ONLINE")}
                              >
                                <FiCreditCard aria-hidden />
                                <span>Online paid</span>
                              </button>
                            </>
                          )}
                          {!unpaid && (
                            <button
                              type="button"
                              className="company-btn company-btn--unblock"
                              disabled={busy}
                              onClick={() => handleApprove(company)}
                            >
                              <FiCheckCircle aria-hidden />
                              <span>{busy ? "Working…" : "Approve"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="create-company-card">
        <h3>Pending users / agents ({users.length})</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="muted">No pending user self-registrations.</p>
        ) : (
          <div className="company-table-wrap">
            <table className="users-table excel-grid-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const userId = user._id || user.id;
                  const busy = actionIds.has(userId);

                  return (
                    <tr key={userId}>
                      <td>{user.name || "—"}</td>
                      <td>{user.email || "—"}</td>
                      <td>{formatRepoRole(user.role)}</td>
                      <td>
                        {user.companyId?.companyName || "—"}
                        {user.companyId?.companyCode && (
                          <span className="field-hint"> ({user.companyId.companyCode})</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="company-btn company-btn--unblock"
                          disabled={busy}
                          onClick={() => handleActivateUser(user)}
                        >
                          <FiShield aria-hidden />
                          <span>{busy ? "Working…" : "Activate"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
