import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiEye, FiSearch, FiShield } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import DataTableToolbar from "../../../components/common/DataTableToolbar";
import ViewBlockReasonModal from "../../../components/common/ViewBlockReasonModal";
import { saveExcelBlob, getApiErrorMessage } from "../../../utils/downloadExcel";
import { printTablePage } from "../../../utils/printTable";
import { BANK_NBFC_NAME_LABEL } from "../../../constants/companyLabels";
import "../../../styles/users.css";

export default function SsdiBlacklist() {
  const { auth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [blockedCompanies, setBlockedCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reasonViewTarget, setReasonViewTarget] = useState(null);
  const isFirstLoad = useRef(true);

  const openReasonModal = (company) => {
    setReasonViewTarget(company);
  };

  const closeReasonModal = () => {
    if (reasonViewTarget && pendingIds.has(reasonViewTarget._id || reasonViewTarget.id)) {
      return;
    }
    setReasonViewTarget(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const showFullLoader = !silent && isFirstLoad.current;

      if (!auth?.token) {
        if (showFullLoader) setLoading(false);
        return;
      }

      try {
        if (showFullLoader) setLoading(true);
        if (!silent) setError("");

        const res = await companyService.getCompanies(auth.token, {
          status: "INACTIVE",
          limit: 50,
          q: debouncedQuery.trim() || undefined,
        });

        const items = res?.data?.items || res?.items || [];
        setBlockedCompanies(Array.isArray(items) ? items : []);
      } catch (err) {
        if (!silent) {
          setError(err?.response?.data?.message || "Failed to load blacklist");
          setBlockedCompanies([]);
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
    loadData({ silent: !isFirstLoad.current });
  }, [loadData]);

  const handleExportExcel = async () => {
    if (!auth?.token) return;

    try {
      setExporting(true);
      const response = await companyService.downloadCompaniesExcel(auth.token, {
        status: "INACTIVE",
        q: debouncedQuery.trim() || undefined,
      });
      await saveExcelBlob(response, "blocked-companies.xlsx");
    } catch (err) {
      alert(await getApiErrorMessage(err, "Failed to download Excel file"));
    } finally {
      setExporting(false);
    }
  };

  const handleUnblockCompany = async (companyId, { fromModal = false } = {}) => {
    if (!window.confirm("Unblock this company?")) return;

    const removed = blockedCompanies.find((c) => (c._id || c.id) === companyId);
    setPendingIds((prev) => new Set(prev).add(companyId));
    setBlockedCompanies((prev) =>
      prev.filter((c) => (c._id || c.id) !== companyId)
    );

    try {
      await companyService.updateCompany(companyId, { status: "ACTIVE" }, auth.token);
      if (fromModal) {
        setReasonViewTarget(null);
      }
    } catch (err) {
      if (removed) {
        setBlockedCompanies((prev) => [removed, ...prev]);
      }
      alert(err?.response?.data?.message || "Failed to unblock company");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  };

  const handleUnblockFromModal = () => {
    if (!reasonViewTarget) return;
    const companyId = reasonViewTarget._id || reasonViewTarget.id;
    handleUnblockCompany(companyId, { fromModal: true });
  };

  const reasonModalCompanyId = reasonViewTarget
    ? reasonViewTarget._id || reasonViewTarget.id
    : null;
  const reasonModalPending = reasonModalCompanyId
    ? pendingIds.has(reasonModalCompanyId)
    : false;

  return (
    <div className="page companies-page blacklist-page">
      <div className="users-actions">
        <h2>All Repo Companies Blocked Details</h2>
      </div>

      <div className="company-search-panel company-search-panel--simple">
        <div className="company-search-bar">
          <FiSearch className="company-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search by code, ${BANK_NBFC_NAME_LABEL.toLowerCase()}, email, or phone...`}
            aria-label="Search blocked companies"
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <DataTableToolbar
        onDownloadExcel={handleExportExcel}
        onPrint={printTablePage}
        downloading={exporting}
        downloadLabel="Download Excel (.xlsx)"
      />

      {loading && blockedCompanies.length === 0 ? (
        <p>Loading blacklist...</p>
      ) : (
        <div className="company-table-wrap printable-table-area">
          <h3 className="print-only-title">All Repo Companies Blocked Details</h3>
          <table className="users-table excel-grid-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Code</th>
                <th>{BANK_NBFC_NAME_LABEL}</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Contact person</th>
                <th>Status</th>
                <th>Repo admin</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blockedCompanies.length === 0 ? (
                <tr>
                  <td colSpan="9">No blocked companies.</td>
                </tr>
              ) : (
                blockedCompanies.map((company, index) => {
                  const companyId = company._id || company.id;
                  const isPending = pendingIds.has(companyId);

                  return (
                    <tr key={companyId} className={isPending ? "row-pending" : ""}>
                      <td>{index + 1}</td>
                      <td>{company.companyCode || "-"}</td>
                      <td>{company.companyName || "-"}</td>
                      <td>{company.email || "-"}</td>
                      <td>{company.phone || "-"}</td>
                      <td>{company.contactPersonName || "-"}</td>
                      <td>
                        <span className="company-status company-status--inactive">
                          {company.status || "INACTIVE"}
                        </span>
                      </td>
                      <td>{company?.repoAdminUserId?.email || "-"}</td>
                      <td className="company-actions-td">
                        <div className="company-actions-cell company-actions-cell--blacklist">
                          <Link
                            to={`/ssdi/companies/${companyId}`}
                            className="company-btn company-btn--view"
                          >
                            <FiEye aria-hidden />
                            <span>View</span>
                          </Link>
                          <button
                            type="button"
                            className="company-btn company-btn--reason"
                            disabled={isPending}
                            onClick={() => openReasonModal(company)}
                            title="View block reason"
                          >
                            <FiAlertCircle aria-hidden />
                            <span>Reason</span>
                          </button>
                          <button
                            type="button"
                            className="company-btn company-btn--unblock"
                            disabled={isPending}
                            onClick={() => handleUnblockCompany(companyId)}
                          >
                            <FiShield aria-hidden />
                            <span>Unblock</span>
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

      <ViewBlockReasonModal
        open={Boolean(reasonViewTarget)}
        companyName={reasonViewTarget?.companyName}
        blockReason={reasonViewTarget?.blockReason}
        blockedAt={reasonViewTarget?.blockedAt}
        onClose={closeReasonModal}
        onUnblock={handleUnblockFromModal}
        unblocking={reasonModalPending}
      />
    </div>
  );
}
