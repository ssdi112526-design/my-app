import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiSearch } from "react-icons/fi";
import bankService from "../../../services/bank.service";
import StatusBadge from "../../../components/common/StatusBadge";

const STATUS_COLORS = {
  active: "success",
  pending_payment: "warning",
  expired: "danger",
  inactive: "neutral",
};

export default function SsdiBanks() {
  const [banks, setBanks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = async (p = page, s = search, st = statusFilter) => {
    setLoading(true);
    try {
      const res = await bankService.ssdiListBanks({ page: p, limit: LIMIT, search: s || undefined, status: st || undefined });
      setBanks(res?.data?.data?.banks || []);
      setTotal(res?.data?.data?.total || 0);
    } catch {/* silent */}
    finally { setLoading(false); }
  };

  useEffect(() => { load(page, search, statusFilter); }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search, statusFilter);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2>Banks ({total})</h2>
        <Link to="/ssdi/banks/create" className="primary-page-btn">
          <FiPlus /> Create Bank
        </Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: 1, minWidth: 200 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, email..."
            style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border,#e5e7eb)", borderRadius: 6 }}
          />
          <button type="submit" className="secondary-page-btn"><FiSearch /></button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", border: "1px solid var(--border,#e5e7eb)", borderRadius: 6 }}
        >
          <option value="">All statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : banks.length === 0 ? (
        <p className="muted">No banks found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--table-head-bg,#f9fafb)", textAlign: "left" }}>
                {["Bank Name", "Code", "Email", "Phone", "Status", "Next Due", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border,#e5e7eb)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b._id} style={{ borderBottom: "1px solid var(--border,#e5e7eb)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{b.bankName}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{b.bankCode}</td>
                  <td style={{ padding: "10px 12px" }}>{b.email}</td>
                  <td style={{ padding: "10px 12px" }}>{b.phone || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge status={b.status} variant={STATUS_COLORS[b.status]} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {b.nextDueAt ? new Date(b.nextDueAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link to={`/ssdi/banks/${b._id}`} className="secondary-page-btn" style={{ fontSize: 12 }}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
          <button className="secondary-page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span style={{ lineHeight: "36px" }}>Page {page} of {totalPages}</span>
          <button className="secondary-page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
