import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiShield, FiShieldOff } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import BlockCompanyModal from "../../../components/common/BlockCompanyModal";
import { formatRepoRole } from "../../../constants/repoRoles";
import { BANK_NBFC_NAME_LABEL } from "../../../constants/companyLabels";
import "../../../styles/users.css";

export default function SsdiCompanyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [error, setError] = useState("");
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPendingIds, setUserPendingIds] = useState(() => new Set());
  const [approving, setApproving] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!id || !auth?.token) return;

    try {
      setLoading(true);
      setError("");

      const res = await companyService.getCompanyById(id, auth.token);

      setCompany(res?.data?.company || res?.company || null);
      setSubscription(res?.data?.subscription || res?.subscription || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load company details");
    } finally {
      setLoading(false);
    }
  }, [id, auth?.token]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const loadCompanyUsers = useCallback(async () => {
    if (!id || !auth?.token) return;

    try {
      setUsersLoading(true);
      const res = await companyService.getCompanyUsers(id, auth.token);
      const list = res?.data?.users || res?.users || [];
      setCompanyUsers(Array.isArray(list) ? list : []);
    } catch {
      setCompanyUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [id, auth?.token]);

  useEffect(() => {
    loadCompanyUsers();
  }, [loadCompanyUsers]);

  const handleMarkPayment = async (method) => {
    if (!company || approving) return;
    const note = window.prompt(
      `Payment note (${method.toLowerCase()}):`,
      company.paymentNote || ""
    );
    if (note === null) return;

    setApproving(true);
    try {
      const res = await companyService.markCompanyPayment(
        company._id || company.id,
        { paymentMethod: method, paymentNote: note },
        auth.token
      );
      const updated = res?.data?.company || res?.company;
      if (updated) setCompany(updated);
      else setCompany((prev) => ({ ...prev, paymentStatus: "PAID", paymentMethod: method }));
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to mark payment");
    } finally {
      setApproving(false);
    }
  };

  const handleApprove = async () => {
    if (!company || approving) return;
    if (!window.confirm(`Approve ${company.companyName}?`)) return;

    setApproving(true);
    try {
      const res = await companyService.approveCompany(
        company._id || company.id,
        auth.token
      );
      const updated = res?.data?.company || res?.company;
      if (updated) setCompany(updated);
      else setCompany((prev) => ({ ...prev, status: "ACTIVE" }));
      await loadCompanyUsers();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve company");
    } finally {
      setApproving(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const userId = user._id || user.id;
    const nextStatus = !user.isActive;
    const previousStatus = user.isActive;

    setUserPendingIds((prev) => new Set(prev).add(userId));
    setCompanyUsers((prev) =>
      prev.map((u) =>
        (u._id || u.id) === userId ? { ...u, isActive: nextStatus } : u
      )
    );

    try {
      await companyService.updateCompanyUserStatus(
        id,
        userId,
        nextStatus,
        auth.token
      );
    } catch (err) {
      setCompanyUsers((prev) =>
        prev.map((u) =>
          (u._id || u.id) === userId ? { ...u, isActive: previousStatus } : u
        )
      );
      alert(err?.response?.data?.message || "Failed to update user status");
    } finally {
      setUserPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const statusBadgeClass = (status) => {
    const key = (status || "").toLowerCase();
    if (key === "active") return "company-status--active";
    if (key === "pending") return "company-status--pending";
    return "company-status--inactive";
  };

  const handleToggleStatus = () => {
    if (!company || statusUpdating || company.status === "PENDING") return;

    if (company.status === "ACTIVE") {
      setShowBlockModal(true);
      return;
    }

    if (!window.confirm("Unblock this company?")) return;
    applyStatusUpdate("ACTIVE");
  };

  const applyStatusUpdate = async (newStatus, blockReason) => {
    if (!company) return;

    const companyId = company._id || company.id;
    const previous = { ...company };

    setStatusUpdating(true);

    if (newStatus === "INACTIVE") {
      setCompany((prev) => ({
        ...prev,
        status: "INACTIVE",
        blockReason: blockReason || "",
        blockedAt: new Date().toISOString(),
      }));
    } else {
      setCompany((prev) => ({
        ...prev,
        status: "ACTIVE",
        blockReason: null,
        blockedAt: null,
      }));
    }

    try {
      const payload =
        newStatus === "INACTIVE"
          ? { status: "INACTIVE", blockReason }
          : { status: "ACTIVE" };

      const res = await companyService.updateCompany(companyId, payload, auth.token);
      const updated = res?.data?.company || res?.company;
      if (updated) {
        setCompany(updated);
      }
    } catch (err) {
      setCompany(previous);
      alert(err?.response?.data?.message || "Failed to update company status");
    } finally {
      setStatusUpdating(false);
      setShowBlockModal(false);
    }
  };

  const handleBlockConfirm = (reason) => {
    applyStatusUpdate("INACTIVE", reason);
  };

  const handleResetPassword = async () => {
    if (!company) return;

    const companyId = company._id || company.id;
    const newPassword = window.prompt("Enter new repo admin password:");

    if (!newPassword) return;

    try {
      const res = await companyService.resetRepoAdminPassword(
        companyId,
        newPassword,
        auth.token
      );

      const updatedPassword = res?.data?.repoAdmin?.password || newPassword;

      alert(
        `Repo admin password updated successfully.\n\nEmail: ${
          company?.repoAdminUserId?.email || "-"
        }\nPassword: ${updatedPassword}`
      );
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reset password");
    }
  };

  if (loading) {
    return <div className="page">Loading company details...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!company) {
    return <div className="page">Company not found.</div>;
  }

  return (
    <div className="page create-company-page">
      <div className="create-company-header">
        <div>
          <h2>Company Details</h2>
          <p className="muted">
            View company profile, repo admin info, and subscription details.
          </p>
        </div>

        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/ssdi/companies")}
        >
          Back to Companies
        </button>
      </div>

      <div className="create-company-form">
        <div className="create-company-card">
          <div className="users-actions" style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: 0 }}>Company Information</h3>

            <span
              className={`company-status ${statusBadgeClass(company.status)}`}
            >
              {company.status}
            </span>
          </div>

          {company.status === "INACTIVE" && company.blockReason && (
            <div className="company-block-reason-banner">
              <strong>Block reason</strong>
              <p>{company.blockReason}</p>
            </div>
          )}

          <div className="form-grid two-column">
            <div className="form-group">
              <label>Company Code</label>
              <input value={company.companyCode || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>{BANK_NBFC_NAME_LABEL}</label>
              <input value={company.companyName || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Contact Person</label>
              <input value={company.contactPersonName || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Company Email</label>
              <input value={company.email || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>First Confirmation Number</label>
              <input value={company.phone || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Owner Name</label>
              <input value={company.ownerName || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>GST Number</label>
              <input value={company.gstNumber || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Aadhaar Number</label>
              <input value={company.aadhaarNumber || "-"} readOnly />
            </div>

            <div className="form-group full-width">
              <label>Address</label>
              <input value={company.address || "-"} readOnly />
            </div>
          </div>
        </div>

        <div className="create-company-card">
          <h3>Repo Admin Information</h3>

          <div className="form-grid two-column">
            <div className="form-group">
              <label>Admin Name</label>
              <input value={company?.repoAdminUserId?.name || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Admin Email</label>
              <input value={company?.repoAdminUserId?.email || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Second Confirmation Number</label>
              <input
                value={company?.repoAdminUserId?.phone || "-"}
                readOnly
              />
              {company?.repoAdminUserId?.phone ? (
                <a
                  href={`tel:${company.repoAdminUserId.phone}`}
                  className="field-hint"
                  style={{ display: "inline-block", marginTop: 6 }}
                >
                  Call admin
                </a>
              ) : null}
            </div>

            <div className="form-group">
              <label>Admin Role</label>
              <input value={company?.repoAdminUserId?.role || "REPO_ADMIN"} readOnly />
            </div>

            <div className="form-group">
              <label>Admin Account Status</label>
              <input
                value={company?.repoAdminUserId?.isActive ? "Active" : "Inactive"}
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Registration Source</label>
              <input
                value={
                  company?.repoAdminUserId?.registrationSource === "SELF"
                    ? "Self registration"
                    : "Created by SSDI"
                }
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Company Status</label>
              <input value={company.status || "-"} readOnly />
            </div>
          </div>
        </div>

        <div className="create-company-card">
          <h3>Subscription Information</h3>

          <div className="form-grid two-column">
            <div className="form-group">
              <label>Plan Name</label>
              <input value={subscription?.planId?.name || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Subscription Status</label>
              <input value={subscription?.status || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Payment Status</label>
              <input value={subscription?.paymentStatus || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Start Date</label>
              <input
                value={
                  subscription?.startDate
                    ? new Date(subscription.startDate).toLocaleDateString()
                    : "-"
                }
                readOnly
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                value={
                  subscription?.endDate
                    ? new Date(subscription.endDate).toLocaleDateString()
                    : "-"
                }
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="create-company-card">
          <h3>Company Users</h3>
          {usersLoading ? (
            <p className="muted">Loading users…</p>
          ) : companyUsers.length === 0 ? (
            <p className="muted">No repo users found for this company.</p>
          ) : (
            <div className="company-table-wrap">
              <table className="users-table excel-grid-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map((user) => {
                    const userId = user._id || user.id;
                    const isUserPending = userPendingIds.has(userId);

                    return (
                      <tr key={userId} className={isUserPending ? "row-pending" : ""}>
                        <td>{user.name || "-"}</td>
                        <td>{user.email || "-"}</td>
                        <td>{user.phone || "-"}</td>
                        <td>{formatRepoRole(user.role)}</td>
                        <td>
                          {user.registrationSource === "SELF" ? "Self" : "Admin"}
                        </td>
                        <td>
                          <span
                            className={`company-status ${
                              user.isActive
                                ? "company-status--active"
                                : "company-status--inactive"
                            }`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="company-actions-td">
                          <button
                            type="button"
                            className={`company-btn ${
                              user.isActive
                                ? "company-btn--block"
                                : "company-btn--unblock"
                            }`}
                            disabled={isUserPending}
                            onClick={() => handleToggleUserStatus(user)}
                          >
                            {user.isActive ? (
                              <FiShieldOff aria-hidden />
                            ) : (
                              <FiShield aria-hidden />
                            )}
                            <span>
                              {user.isActive ? "Deactivate" : "Activate"}
                            </span>
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

        <div className="create-company-actions">
          {company.status === "PENDING" ? (
            <>
              {company.paymentStatus !== "PAID" ? (
                <>
                  <button
                    type="button"
                    className="secondary-page-btn"
                    disabled={approving}
                    onClick={() => handleMarkPayment("OFFLINE")}
                  >
                    Mark offline payment
                  </button>
                  <button
                    type="button"
                    className="secondary-page-btn"
                    disabled={approving}
                    onClick={() => handleMarkPayment("ONLINE")}
                  >
                    Mark online payment
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-page-btn"
                  disabled={approving}
                  onClick={handleApprove}
                >
                  {approving ? "Approving…" : "Approve Company"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="secondary-page-btn"
              disabled={statusUpdating}
              onClick={handleToggleStatus}
            >
              {statusUpdating
                ? "Updating..."
                : company.status === "ACTIVE"
                  ? "Block Company"
                  : "Unblock Company"}
            </button>
          )}

          <button
            type="button"
            className="secondary-page-btn"
            onClick={handleResetPassword}
          >
            Reset Repo Admin Password
          </button>
        </div>
      </div>

      <BlockCompanyModal
        open={showBlockModal}
        companyName={company?.companyName}
        loading={statusUpdating}
        onCancel={() => !statusUpdating && setShowBlockModal(false)}
        onConfirm={handleBlockConfirm}
      />
    </div>
  );
}