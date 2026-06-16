import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiEye,
  FiKey,
  FiSearch,
  FiShield,
  FiShieldOff,
} from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { repoUserService } from "../../../services/repoUser.service";
import repoAdminService from "../../../services/repoAdmin.service";
import DataTableToolbar from "../../../components/common/DataTableToolbar";
import { saveExcelBlob, getApiErrorMessage } from "../../../utils/downloadExcel";
import { printTablePage } from "../../../utils/printTable";
import { formatRepoRole } from "../../../constants/repoRoles";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import "../../../styles/users.css";

export default function Users() {
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [exportingUsers, setExportingUsers] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      const showFullLoader = !silent && isFirstLoad.current;

      if (!auth?.token) {
        if (showFullLoader) setLoading(false);
        return;
      }

      try {
        if (showFullLoader) setLoading(true);
        if (!silent) setError("");

        const params = {};
        if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

        const res = await repoUserService.getUsers(auth.token, params);
        const list = res?.data || res?.users || [];
        setUsers(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!silent) {
          setError(err?.response?.data?.message || "Failed to load users");
          setUsers([]);
        }
      } finally {
        if (showFullLoader) {
          setLoading(false);
          isFirstLoad.current = false;
        }
      }
    },
    [auth?.token, debouncedQuery]
  );

  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  useEffect(() => {
    loadUsers({ silent: !isFirstLoad.current });
  }, [loadUsers]);

  useEffect(() => {
    if (!auth?.token || !isRepoAdmin) return;

    repoAdminService
      .getMyCompany(auth.token)
      .then((res) => {
        setCompanyInfo(res?.data?.company || res?.company || null);
      })
      .catch(() => setCompanyInfo(null));
  }, [auth?.token, isRepoAdmin]);

  const agentRegisterUrl = companyInfo?.companyCode
    ? `${window.location.origin}/agent-register?code=${encodeURIComponent(
        companyInfo.companyCode
      )}`
    : "";

  const handleCopyAgentLink = async () => {
    if (!agentRegisterUrl) return;
    try {
      await navigator.clipboard.writeText(agentRegisterUrl);
      alert("Agent registration link copied.");
    } catch {
      alert(agentRegisterUrl);
    }
  };

  const handleToggleStatus = async (user) => {
    const userId = user._id || user.id;
    const nextStatus = !user.isActive;
    const previousStatus = user.isActive;

    setPendingIds((prev) => new Set(prev).add(userId));
    setUsers((prev) =>
      prev.map((u) =>
        (u._id || u.id) === userId ? { ...u, isActive: nextStatus } : u
      )
    );

    try {
      await repoUserService.changeUserStatus(userId, nextStatus, auth.token);
    } catch (err) {
      setUsers((prev) =>
        prev.map((u) =>
          (u._id || u.id) === userId ? { ...u, isActive: previousStatus } : u
        )
      );
      alert(err?.response?.data?.message || "Failed to update user status");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleResetPassword = async (user) => {
    const userId = user._id || user.id;
    const newPassword = window.prompt(`Enter new password for ${user.name}:`);

    if (!newPassword) return;

    try {
      await repoUserService.resetUserPassword(userId, newPassword, auth.token);
      alert("Password reset successful");
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reset password");
    }
  };

  const handleExportUsers = async () => {
    if (!auth?.token) return;

    try {
      setExportingUsers(true);
      const params = {};
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

      const response = await repoUserService.downloadUsersExcel(
        auth.token,
        params
      );
      await saveExcelBlob(response, "users.xlsx");
    } catch (err) {
      alert(await getApiErrorMessage(err, "Failed to download users Excel"));
    } finally {
      setExportingUsers(false);
    }
  };

  return (
    <div className="page companies-page">
      <div className="users-actions">
        <h2>Users</h2>
      </div>

      <div className="company-search-panel company-search-panel--simple">
        <div className="company-search-bar">
          <FiSearch className="company-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or role..."
            aria-label="Search users"
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isRepoAdmin && companyInfo?.companyCode && (
        <div className="agent-register-banner">
          <div>
            <strong>Agent self-registration</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Share this link or company code{" "}
              <code>{companyInfo.companyCode}</code> so agents can register via
              the APK. New accounts stay inactive until you activate them.
            </p>
          </div>
          <button
            type="button"
            className="secondary-page-btn"
            onClick={handleCopyAgentLink}
          >
            Copy registration link
          </button>
        </div>
      )}

      <DataTableToolbar
        onDownloadExcel={handleExportUsers}
        onPrint={printTablePage}
        downloading={exportingUsers}
        downloadLabel="Download users (Excel)"
      >
        {isRepoAdmin && (
          <Link to="/users/create">
            <button type="button" className="primary-page-btn">
              + Create User
            </button>
          </Link>
        )}
      </DataTableToolbar>

      {loading && users.length === 0 ? (
        <p>Loading users...</p>
      ) : (
        <div className="company-table-wrap printable-table-area">
          <h3 className="print-only-title">Users</h3>
          <table className="users-table excel-grid-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Vehicle number(s)</th>
                <th>Role</th>
                <th>Source</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8">No users match your search.</td>
                </tr>
              ) : (
                users.map((user) => {
                  const userId = user._id || user.id;
                  const isAdmin = user.role === "REPO_ADMIN";
                  const isPending = pendingIds.has(userId);

                  return (
                    <tr key={userId} className={isPending ? "row-pending" : ""}>
                      <td>{user.name || "-"}</td>
                      <td>{user.email || "-"}</td>
                      <td>{user.phone || "-"}</td>
                      <td className="users-table-vehicles">
                        {Array.isArray(user.assignedVehicleNumbers) &&
                        user.assignedVehicleNumbers.length > 0
                          ? user.assignedVehicleNumbers
                              .map((v) => formatVehicleNumberDisplay(v))
                              .join(", ")
                          : "—"}
                      </td>
                      <td>{formatRepoRole(user.role)}</td>
                      <td>
                        {user.registrationSource === "SELF" ? "Self" : "Admin"}
                      </td>
                      <td>
                        <span
                          className={`company-status company-status--${
                            user.isActive ? "active" : "inactive"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="company-actions-td">
                        <div className="company-actions-cell">
                          <Link
                            to={`/users/${userId}`}
                            className="company-btn company-btn--view"
                          >
                            <FiEye aria-hidden />
                            <span>View</span>
                          </Link>

                          {!isAdmin && isRepoAdmin && (
                            <>
                              <button
                                type="button"
                                className={`company-btn ${
                                  user.isActive
                                    ? "company-btn--block"
                                    : "company-btn--unblock"
                                }`}
                                disabled={isPending}
                                onClick={() => handleToggleStatus(user)}
                              >
                                {user.isActive ? (
                                  <FiShieldOff aria-hidden />
                                ) : (
                                  <FiShield aria-hidden />
                                )}
                                <span>
                                  {user.isActive ? "Block" : "Unblock"}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="company-btn company-btn--reset"
                                onClick={() => handleResetPassword(user)}
                              >
                                <FiKey aria-hidden />
                                <span>Reset Password</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
