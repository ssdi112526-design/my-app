import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import confirmationService from "../../../services/confirmation.service";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import { withReturnPath } from "../../../utils/navReturn";
import "../../../styles/bankDetails.css";
import "../../../styles/users.css";
import "../../../styles/confirmation.css";

const PAGE_SIZE = 100;

function statusBadge(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return "cf-badge cf-badge--pending";
  if (normalized === "CONFIRMED") return "cf-badge cf-badge--confirmed";
  if (normalized === "REJECTED") return "cf-badge cf-badge--rejected";
  return "cf-badge";
}

function formatReportedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function matchesSearch(row, query) {
  if (!query) return true;
  const haystack = [
    row.caseCode,
    row.vehicleNumber,
    row.customerName,
    row.bankName,
    row.branchName,
    row.requestedByName,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortCases(rows) {
  return [...rows].sort((a, b) => {
    const aPending = String(a.status || "").toUpperCase() === "PENDING";
    const bPending = String(b.status || "").toUpperCase() === "PENDING";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export default function CasesList() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [allRows, setAllRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const query = search.trim();
    if (!query) return allRows;
    return allRows.filter((row) => matchesSearch(row, query));
  }, [allRows, search]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError("");
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        confirmationService.getAll(auth.token, { status: "PENDING" }),
        confirmationService.getAll(auth.token, { status: "CONFIRMED" }),
      ]);

      const pending = Array.isArray(pendingRes?.data) ? pendingRes.data : [];
      const confirmed = Array.isArray(confirmedRes?.data) ? confirmedRes.data : [];
      setAllRows(sortCases([...pending, ...confirmed]));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load cases.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCase = (row) => {
    if (!row?.caseId) return;
    navigate(withReturnPath(`/details-view?id=${row.caseId}`, "/cases"), {
      state: { from: "/cases" },
    });
  };

  if (auth?.user?.role !== "REPO_ADMIN") {
    return <Navigate to="/find-vehicles" replace />;
  }

  return (
    <div className="bd-page cases-page cf-page">
      <div className="users-actions">
        <h2>All Trace Vehicle Details</h2>
      </div>
      <div className="bd-form-card cases-page__search">
        <label className="bd-field bd-field-full">
          <span className="bd-label">Search</span>
          <input
            type="search"
            placeholder="Vehicle, customer, loan account, bank…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {error && <p className="bd-feedback bd-error">{error}</p>}

      {loading ? (
        <p className="cf-excel-loading">Loading cases…</p>
      ) : pageRows.length === 0 && !error ? (
        <p className="cf-excel-loading">
          No pending or confirmed cases yet. When field staff trace a vehicle, it will
          appear here.
        </p>
      ) : (
        <div className="company-table-wrap cf-excel-sheet cases-page__table table-scroll">
          <table className="users-table excel-grid-table cf-excel-list-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Case Code</th>
                <th>Registration Number</th>
                <th>Customer Name</th>
                <th>Bank Name</th>
                <th>Branch Name</th>
                <th>Status</th>
                <th>User</th>
                <th>Role</th>
                <th>Reported At</th>
                <th className="cf-action-th">Tracer report</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const status = String(row.status || "—").toUpperCase();

                return (
                  <tr
                    key={row._id}
                    className={`${status === "PENDING" ? "confirmation-row-pending" : ""} confirmation-row-clickable`}
                    onClick={() => openCase(row)}
                  >
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{row.caseCode || "—"}</td>
                    <td>{formatVehicleNumberDisplay(row.vehicleNumber) || "—"}</td>
                    <td>{row.customerName || "—"}</td>
                    <td>{row.bankName || "—"}</td>
                    <td>{row.branchName || "—"}</td>
                    <td className="cases-status-cell">
                      <span className={`${statusBadge(status)} cases-status-badge`}>
                        {status}
                      </span>
                    </td>
                    <td>{row.requestedByName || "—"}</td>
                    <td>{row.requestedByRoleLabel || row.requestedByRole || "—"}</td>
                    <td>{formatReportedAt(row.createdAt)}</td>
                    <td className="cf-action-td" onClick={(e) => e.stopPropagation()}>
                      {row.caseId ? (
                        <div className="bd-case-actions" style={{ minWidth: 0 }}>
                          <Link
                            to={withReturnPath(`/details-view?id=${row.caseId}`, "/cases")}
                            className="bd-btn bd-btn-primary bd-btn-compact"
                            state={{ from: "/cases" }}
                          >
                            Details
                          </Link>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="bd-cases-pagination">
          <button
            type="button"
            className="bd-btn bd-btn-secondary bd-btn-compact"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="bd-cases-pagination__info">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <button
            type="button"
            className="bd-btn bd-btn-secondary bd-btn-compact"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
