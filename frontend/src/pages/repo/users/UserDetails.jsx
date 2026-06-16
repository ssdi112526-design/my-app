import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { FiKey, FiSave, FiShield, FiShieldOff, FiSmartphone } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { repoUserService } from "../../../services/repoUser.service";
import { formatRepoRole, isManageableRepoUser } from "../../../constants/repoRoles";
import "../../../styles/users.css";
import "../../../styles/profile.css";

export default function UserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth, patchUser } = useAuth();

  const [user, setUser] = useState(null);
  const [phoneEdit, setPhoneEdit] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [error, setError] = useState("");

  const loadUser = useCallback(async () => {
    if (!id || !auth?.token) return;

    try {
      setLoading(true);
      setError("");

      const res = await repoUserService.getUserById(id, auth.token);
      const loaded = res?.data || res?.user || null;
      setUser(loaded);
      setPhoneEdit(loaded?.phone || "");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load user details");
    } finally {
      setLoading(false);
    }
  }, [id, auth?.token]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleToggleStatus = async () => {
    if (!user || statusUpdating) return;

    const userId = user._id || user.id;
    const nextStatus = !user.isActive;
    const previousStatus = user.isActive;

    setStatusUpdating(true);
    setUser((prev) => ({ ...prev, isActive: nextStatus }));

    try {
      await repoUserService.changeUserStatus(userId, nextStatus, auth.token);
    } catch (err) {
      setUser((prev) => ({ ...prev, isActive: previousStatus }));
      alert(err?.response?.data?.message || "Failed to update user status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;

    const userId = user._id || user.id;
    const newPassword = window.prompt(
      `Enter new password for ${user.name || "this user"}:`
    );

    if (!newPassword) return;

    try {
      await repoUserService.resetUserPassword(userId, newPassword, auth.token);
      alert("Password reset successful");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reset password");
    }
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const trimmed = phoneEdit.trim();
    if (trimmed.replace(/\D/g, "").length < 10) {
      setPhoneMessage("");
      alert("Enter a valid mobile number (at least 10 digits).");
      return;
    }

    const userId = user._id || user.id;
    const isSelf =
      String(userId) === String(auth?.user?.id || auth?.user?._id);

    setPhoneSaving(true);
    setPhoneMessage("");

    try {
      if (isSelf && user.role === "REPO_ADMIN") {
        const { authService } = await import("../../../services/auth.service");
        const res = await authService.updateProfile({ phone: trimmed }, auth.token);
        const updated = res?.data?.user || res?.user;
        setUser((prev) => ({ ...prev, phone: updated?.phone || trimmed }));
        setPhoneEdit(updated?.phone || trimmed);
        patchUser({ phone: updated?.phone || trimmed });
        setPhoneMessage("Mobile updated.");
      } else if (isRepoAdmin && isManageableRepoUser(user.role)) {
        const res = await repoUserService.updateUser(userId, { phone: trimmed }, auth.token);
        const updated = res?.data || res?.user;
        setUser((prev) => ({ ...prev, phone: updated?.phone || trimmed }));
        setPhoneEdit(updated?.phone || trimmed);
        setPhoneMessage("Mobile updated.");
      }
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update mobile");
    } finally {
      setPhoneSaving(false);
    }
  };

  if (loading) {
    return <div className="page">Loading user details...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <p className="error-text">{error}</p>
        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/users")}
        >
          Back to Users
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <p>User not found.</p>
        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/users")}
        >
          Back to Users
        </button>
      </div>
    );
  }

  const userId = user._id || user.id;
  const isTargetAdmin = user.role === "REPO_ADMIN";
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";
  const isSelf = String(userId) === String(auth?.user?.id || auth?.user?._id);
  const canManage = isRepoAdmin && isManageableRepoUser(user.role);
  const canEditPhone = canManage || (isSelf && isRepoAdmin);

  if (isSelf && !isRepoAdmin) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="page create-company-page profile-page">
      <div className="create-company-header">
        <div>
          <h2>User Details</h2>
          {isSelf && (
            <p className="muted">
              This is your account. You can also update mobile from{" "}
              <Link to="/profile">Profile</Link>.
            </p>
          )}
        </div>

        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/users")}
        >
          Back to Users
        </button>
      </div>

      <div className="create-company-form">
        <div className="create-company-card">
          <section className="create-company-section" aria-labelledby="user-details-head">
            <header className="create-company-section__head users-actions" id="user-details-head">
              <h3 style={{ margin: 0 }}>Profile information</h3>
              <span
                className={`company-status company-status--${
                  user.isActive ? "active" : "inactive"
                }`}
              >
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </header>

            <div className="form-grid two-column">
            <div className="form-group">
              <label>Full Name</label>
              <input value={user.name || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Father&apos;s Name</label>
              <input value={user.fatherName || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input value={user.email || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>
                <FiSmartphone aria-hidden style={{ marginRight: 6 }} />
                Mobile number
              </label>
              {canEditPhone ? (
                <>
                  <input
                    type="tel"
                    value={phoneEdit}
                    onChange={(e) => setPhoneEdit(e.target.value)}
                    placeholder="Enter mobile number"
                    disabled={phoneSaving}
                  />
                  <button
                    type="button"
                    className="primary-page-btn"
                    style={{ marginTop: 10, width: "auto" }}
                    disabled={phoneSaving}
                    onClick={handleSavePhone}
                  >
                    <FiSave aria-hidden />
                    {phoneSaving ? "Saving…" : "Save mobile"}
                  </button>
                  {phoneMessage && (
                    <p className="field-hint muted" style={{ marginTop: 8 }}>
                      {phoneMessage}
                    </p>
                  )}
                </>
              ) : (
                <input value={user.phone || "-"} readOnly />
              )}
              {user.phone && !canEditPhone ? (
                <a href={`tel:${user.phone}`} className="field-hint">
                  Call user
                </a>
              ) : null}
            </div>

            <div className="form-group">
              <label>Role</label>
              <input value={formatRepoRole(user.role)} readOnly />
            </div>

            <div className="form-group">
              <label>Blood Group</label>
              <span
                className={`blood-group-badge${user.bloodGroup ? "" : " empty"}`}
              >
                {user.bloodGroup || "-"}
              </span>
            </div>

            <div className="form-group full-width">
              <label>Address</label>
              <input value={user.address || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>City</label>
              <input value={user.city || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>State</label>
              <input value={user.state || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Pincode</label>
              <input value={user.pincode || "-"} readOnly />
            </div>

            <div className="form-group">
              <label>Account Status</label>
              <input value={user.isActive ? "Active" : "Inactive"} readOnly />
            </div>

            <div className="form-group">
              <label>User ID</label>
              <input value={userId || "-"} readOnly className="input-readonly" />
            </div>
          </div>
          </section>
        </div>
        {(canManage || (isRepoAdmin && isSelf)) && (
          <div className="create-company-actions">
            {canManage && (
              <button
                type="button"
                className={`company-btn ${
                  user.isActive ? "company-btn--block" : "company-btn--unblock"
                }`}
                disabled={statusUpdating}
                onClick={handleToggleStatus}
              >
                {user.isActive ? (
                  <FiShieldOff aria-hidden />
                ) : (
                  <FiShield aria-hidden />
                )}
                <span>
                  {statusUpdating
                    ? "Updating..."
                    : user.isActive
                      ? "Block User"
                      : "Unblock User"}
                </span>
              </button>
            )}

            {isRepoAdmin && !isTargetAdmin && (
              <button
                type="button"
                className="company-btn company-btn--reset"
                onClick={handleResetPassword}
              >
                <FiKey aria-hidden />
                <span>Reset Password</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
