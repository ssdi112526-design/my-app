import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiKey, FiSearch, FiShield, FiShieldOff, FiCheckCircle } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import DataTableToolbar from "../../../components/common/DataTableToolbar";
import BlockCompanyModal from "../../../components/common/BlockCompanyModal";
import { saveExcelBlob, getApiErrorMessage } from "../../../utils/downloadExcel";
import { printTablePage } from "../../../utils/printTable";
import { BANK_NBFC_NAME_LABEL } from "../../../constants/companyLabels";
import "../../../styles/users.css";

export default function SsdiCompanies() {
  const { auth } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [approvingIds, setApprovingIds] = useState(() => new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCompanies = useCallback(
    async ({ silent = false } = {}) => {
      const showFullLoader = !silent && isFirstLoad.current;

      if (!auth?.token) {
        if (showFullLoader) setLoading(false);
        return;
      }

      try {
        if (showFullLoader) setLoading(true);
        if (!silent) setError("");

        const params = { page: 1, limit: 200 };
        if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

        const res = await companyService.getCompanies(auth.token, params);
        const items = res?.data?.items || res?.items || [];
        setCompanies(Array.isArray(items) ? items : []);
      } catch (err) {
        if (!silent) {
          setError(err?.response?.data?.message || "Failed to load companies");
          setCompanies([]);
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

  useEffect(() => {
    const silent = !isFirstLoad.current;
    loadCompanies({ silent });
  }, [loadCompanies]);

  const updateCompanyStatus = async (company, newStatus, blockReason) => {
    const companyId = company?._id || company?.id;
    const previous = { ...company };

    setPendingIds((prev) => new Set(prev).add(companyId));
    setCompanies((prev) =>
      prev.map((c) => {
        if ((c._id || c.id) !== companyId) return c;
        if (newStatus === "INACTIVE") {
          return {
            ...c,
            status: "INACTIVE",
            blockReason: blockReason || "",
            blockedAt: new Date().toISOString(),
          };
        }
        return { ...c, status: "ACTIVE", blockReason: null, blockedAt: null };
      })
    );

    try {
      const payload =
        newStatus === "INACTIVE"
          ? { status: "INACTIVE", blockReason }
          : { status: "ACTIVE" };

      await companyService.updateCompany(companyId, payload, auth.token);
    } catch (err) {
      setCompanies((prev) =>
        prev.map((c) => ((c._id || c.id) === companyId ? previous : c))
      );
      alert(err?.response?.data?.message || "Failed to update company status");
      throw err;
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  };

  const handleStatusClick = (company) => {
    if (company.status === "PENDING") return;
    if (company.status === "ACTIVE") {
      setBlockTarget(company);
      return;
    }
    if (!window.confirm("Unblock this company?")) return;
    updateCompanyStatus(company, "ACTIVE");
  };

  const handleApprove = async (company) => {
    const companyId = company?._id || company?.id;
    if (!companyId || approvingIds.has(companyId)) return;
    if (!window.confirm(`Approve ${company.companyName || "this company"}?`)) return;

    setApprovingIds((prev) => new Set(prev).add(companyId));
    try {
      const res = await companyService.approveCompany(companyId, auth.token);
      const updated = res?.data?.company || res?.company;
      setCompanies((prev) =>
        prev.map((c) =>
          (c._id || c.id) === companyId
            ? { ...c, ...(updated || {}), status: "ACTIVE" }
            : c
        )
      );
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to approve company");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  };

  const handleBlockConfirm = async (reason) => {
    if (!blockTarget) return;

    try {
      setBlockSubmitting(true);
      await updateCompanyStatus(blockTarget, "INACTIVE", reason);
      setBlockTarget(null);
    } catch {
      // error alert handled in updateCompanyStatus
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!auth?.token) return;

    try {
      setExporting(true);
      const params = {};
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

      const response = await companyService.downloadCompaniesExcel(
        auth.token,
        params
      );
      await saveExcelBlob(response, "companies.xlsx");
    } catch (err) {
      alert(err?.message || (await getApiErrorMessage(err, "Failed to download Excel file")));
    } finally {
      setExporting(false);
    }
  };

  const handleResetPassword = async (company) => {
    const companyId = company?._id || company?.id;
    const newPassword = window.prompt(
      `Enter new password for ${company.companyName}:`
    );

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
          company?.repoAdminUserId?.email || "N/A"
        }\nPassword: ${updatedPassword}`
      );
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to reset password");
    }
  };

  return (
    <div className="page companies-page">
      <div className="users-actions">
        <h2>All Repo Companies Details</h2>

      </div>

      <div className="company-search-panel company-search-panel--simple">
        <div className="company-search-bar">
          <FiSearch className="company-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search by code, ${BANK_NBFC_NAME_LABEL.toLowerCase()}, email, or phone...`}
            aria-label="Search companies"
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <DataTableToolbar
        onDownloadExcel={handleExportExcel}
        onPrint={printTablePage}
        downloading={exporting}
        downloadLabel="Download Excel (.xlsx)"
      >
        <Link to="/ssdi/companies/create">
          <button type="button" className="primary-page-btn">
            + Create Company
          </button>
        </Link>
      </DataTableToolbar>

      {loading && companies.length === 0 ? (
        <p>Loading companies...</p>
      ) : (
        <div className="company-table-wrap printable-table-area">
            <h3 className="print-only-title">All Repo Companies Details</h3>
            <table className="users-table excel-grid-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>{BANK_NBFC_NAME_LABEL}</th>
                <th>Email</th>
                <th>First Confirmation Number</th>
                <th>Status</th>
                <th>Repo Admin</th>
                <th>Second Confirmation Number</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan="8">No companies match your search.</td>
                </tr>
              ) : (
                companies.map((company) => {
                  const companyId = company?._id || company?.id;
                  const isPending = pendingIds.has(companyId);
                  const isApproving = approvingIds.has(companyId);
                  const isPendingStatus = company.status === "PENDING";

                  return (
                    <tr key={companyId} className={isPending ? "row-pending" : ""}>
                      <td>{company.companyCode || "-"}</td>
                      <td>{company.companyName || "-"}</td>
                      <td>{company.email || "-"}</td>
                      <td>{company.phone || "-"}</td>
                      <td>
                        <span
                          className={`company-status company-status--${(
                            company.status || ""
                          ).toLowerCase()}`}
                        >
                          {company.status || "-"}
                        </span>
                      </td>
                      <td>{company?.repoAdminUserId?.email || "-"}</td>
                      <td>{company?.repoAdminUserId?.phone || "-"}</td>
                      <td className="company-actions-td">
                        <div className="company-actions-cell">
                          <Link
                            to={`/ssdi/companies/${companyId}`}
                            className="company-btn company-btn--view"
                          >
                            <FiEye aria-hidden />
                            <span>View</span>
                          </Link>

                          {isPendingStatus ? (
                            <button
                              type="button"
                              className="company-btn company-btn--unblock"
                              disabled={isApproving}
                              onClick={() => handleApprove(company)}
                            >
                              <FiCheckCircle aria-hidden />
                              <span>{isApproving ? "Approving…" : "Approve"}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`company-btn ${
                                company.status === "ACTIVE"
                                  ? "company-btn--block"
                                  : "company-btn--unblock"
                              }`}
                              disabled={isPending}
                              onClick={() => handleStatusClick(company)}
                            >
                              {company.status === "ACTIVE" ? (
                                <FiShieldOff aria-hidden />
                              ) : (
                                <FiShield aria-hidden />
                              )}
                              <span>
                                {company.status === "ACTIVE" ? "Block" : "Unblock"}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="company-btn company-btn--reset"
                            onClick={() => handleResetPassword(company)}
                          >
                            <FiKey aria-hidden />
                            <span>Reset Password</span>
                          </button>
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

      <BlockCompanyModal
        open={Boolean(blockTarget)}
        companyName={blockTarget?.companyName}
        loading={blockSubmitting}
        onCancel={() => !blockSubmitting && setBlockTarget(null)}
        onConfirm={handleBlockConfirm}
      />
    </div>
  );
}
