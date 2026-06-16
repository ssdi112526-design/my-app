import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import confirmationService from "../../../services/confirmation.service";
import { getReturnLabel, getReturnPath } from "../../../utils/navReturn";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import "../../../styles/users.css";
import "../../../styles/confirmation.css";

function formatReportedAt(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function inventoryBadge(item) {
  if (item.inventoryRevisionRequested) {
    return <span className="cf-badge cf-badge--pending">Update needed</span>;
  }
  if (item.inventoryConfirmed) {
    return <span className="cf-badge cf-badge--confirmed">Confirmed</span>;
  }
  if (item.inventorySubmitted) {
    return <span className="cf-badge cf-badge--pending">Pending approval</span>;
  }
  return <span className="cf-badge cf-badge--pending">Pending upload</span>;
}

export default function ConfirmedCasesReport() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  const returnTo = getReturnPath(searchParams, location.state, "/reports");
  const returnLabel = getReturnLabel(returnTo);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");
      const res = await confirmationService.getAll(auth.token, { status: "CONFIRMED" });
      const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      const confirmedOnly = items.filter(
        (item) => String(item?.status || "").toUpperCase() === "CONFIRMED"
      );

      setRows(confirmedOnly);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load confirmed cases");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const openRow = (item) => {
    if (!item?._id) return;
    if (item.inventorySubmitted) {
      navigate(`/inventory-update?confirmationId=${item._id}`);
      return;
    }
    navigate(`/confirmation/${item._id}`, { state: { from: `${location.pathname}${location.search}` } });
  };

  if (!isRepoAdmin) {
    return <Navigate to="/reports" replace />;
  }

  return (
    <div className="page cf-page">
      <div className="cf-view-top">
        <Link to={returnTo} className="cf-view-back">
          ← Back to {returnLabel}
        </Link>
      </div>

      <div className="company-table-wrap cf-excel-sheet">
        <div className="cf-top-row">
          <h3 className="cf-table-title">Confirmed Cases</h3>
          <button type="button" className="secondary-page-btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <p className="muted reports-table-hint">
          Only admin-confirmed traces are listed here. Pending traces are not included.
        </p>

        {error ? <p className="error-text">{error}</p> : null}

        {loading ? (
          <p className="cf-excel-loading">Loading confirmed cases…</p>
        ) : rows.length === 0 ? (
          <p className="cf-excel-loading">No confirmed cases yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="users-table excel-grid-table cf-excel-list-table">
              <thead>
                <tr>
                  <th>Case Code</th>
                  <th>Registration Number</th>
                  <th>Customer Name</th>
                  <th>Bank Name</th>
                  <th>Branch Name</th>
                  <th>Traced By</th>
                  <th>Role</th>
                  <th>Reporter Mobile</th>
                  <th>Field Note</th>
                  <th>Reported At</th>
                  <th>Inventory</th>
                  <th className="cf-action-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item._id}
                    className="confirmation-row-clickable"
                    onClick={() => openRow(item)}
                  >
                    <td>{item.caseCode || "—"}</td>
                    <td>{formatVehicleNumberDisplay(item.vehicleNumber) || "—"}</td>
                    <td>{item.customerName || "—"}</td>
                    <td>{item.bankName || "—"}</td>
                    <td>{item.branchName || "—"}</td>
                    <td>{item.requestedByName || "—"}</td>
                    <td>{item.requestedByRoleLabel || item.requestedByRole || "—"}</td>
                    <td>{item.requestedByPhone || "—"}</td>
                    <td className="cf-excel-note">{item.requestNote || "—"}</td>
                    <td>{formatReportedAt(item.createdAt)}</td>
                    <td>{inventoryBadge(item)}</td>
                    <td className="cf-action-td" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cf-open-btn"
                        onClick={() =>
                          navigate(`/confirmation/${item._id}`, {
                            state: { from: `${location.pathname}${location.search}` },
                          })
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
