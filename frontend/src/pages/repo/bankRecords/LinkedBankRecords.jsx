import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiDatabase, FiInfo } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import bankService from "../../../services/bank.service";
import BankRecordDetailModal from "../../../components/bank/BankRecordDetailModal";
import VehicleNumberPlate from "../../../components/bank/VehicleNumberPlate";
import { shouldShowFullBankRecordFields } from "../../../utils/bankRecordFieldVisibility";
import { getBankerFieldsFromBankRecord } from "../../../utils/bankRecordBankerFields";
import {
  coerceBankerNameDisplay,
  coerceBankerPhoneDisplay,
} from "../../../utils/bankerValueUtils";
import "../../../styles/bankRecordDetail.css";

function formatBankerTableCell(value, kind = "name") {
  const t = String(value ?? "").trim();
  if (!t || t.toUpperCase() === "NA") return "—";
  const display =
    kind === "phone" ? coerceBankerPhoneDisplay(t) : coerceBankerNameDisplay(t);
  return display || "—";
}

export default function LinkedBankRecords() {
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const isRepoAdmin = role === "REPO_ADMIN";
  const showFull = shouldShowFullBankRecordFields(role);

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [linkedBankers, setLinkedBankers] = useState([]);

  const LIMIT = 30;

  const tableHeaders = useMemo(() => {
    const base = ["Vehicle No", "Borrower", "Phone"];
    if (showFull) {
      base.push(
        "1st bankar Name",
        "mobile no 1",
        "Loan Account",
        "Outstanding (₹)",
        "Branch",
        "Bank",
        "Uploaded By"
      );
    } else {
      base.push("Outstanding (₹)");
    }
    base.push("Status", "");
    return base;
  }, [showFull]);

  const loadRecords = async (p = 1, s = "") => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT, search: s || undefined };
      const res = isRepoAdmin
        ? await bankService.getLinkedRecords(params)
        : await bankService.getAssignedRecords(params);

      const list = res?.data?.data?.records || [];
      setRecords(list);
      setTotal(res?.data?.data?.total || 0);

      if (isRepoAdmin) {
        const bankerMap = {};
        for (const r of list) {
          if (r.uploadedBy?._id) {
            bankerMap[r.uploadedBy._id] = {
              name: r.uploadedBy.name,
              email: r.uploadedBy.email,
              bank: r.bankId?.bankName || "—",
              bankCode: r.bankId?.bankCode || "",
            };
          }
        }
        setLinkedBankers(Object.values(bankerMap));
      } else {
        setLinkedBankers([]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(1, "");
  }, [isRepoAdmin]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadRecords(1, search);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadRecords(newPage, search);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Bank Records</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          {isRepoAdmin
            ? "Records uploaded by banks linked to your agency. Open a row for full Excel details including banker names and mobiles."
            : "Bank recovery data from banks linked to your agency (same cases as admin; loan and banker contacts are admin-only)."}
        </p>
      </div>

      {linkedBankers.length > 0 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <FiInfo size={16} color="#2563eb" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: "#1e40af", marginBottom: 4 }}>
              Connected banks sending you data:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {linkedBankers.map((b, i) => (
                <span
                  key={i}
                  style={{
                    padding: "3px 10px",
                    background: "#dbeafe",
                    borderRadius: 20,
                    fontSize: 12,
                    color: "#1e3a8a",
                    fontWeight: 500,
                  }}
                >
                  {b.bank} {b.bankCode ? `(${b.bankCode})` : ""} — {b.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            showFull
              ? "Search vehicle, borrower, loan, mobile no…"
              : "Search vehicle or borrower name…"
          }
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--border,#e5e7eb)",
            borderRadius: 6,
          }}
        />
        <button type="submit" className="secondary-page-btn">
          <FiSearch /> Search
        </button>
      </form>

      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {total.toLocaleString()}{" "}
        {isRepoAdmin ? "records from linked banks" : "records from your agency’s linked banks"}
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          <FiDatabase size={40} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12, fontWeight: 500 }}>No bank records yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            {isRepoAdmin
              ? "SSDI needs to link a bank to your agency first. Once linked, bank-uploaded records appear here."
              : "SSDI must link a bank to your agency’s admin account first."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--table-head-bg,#f9fafb)", textAlign: "left" }}>
                {tableHeaders.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--border,#e5e7eb)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={r._id}
                  className="bank-records-table__row"
                  style={{ borderBottom: "1px solid var(--border,#e5e7eb)" }}
                  onClick={() => setDetailId(r._id)}
                >
                  <td className="bank-records-table__vehicle-cell" style={{ padding: "10px 12px" }}>
                    <VehicleNumberPlate record={r} size="sm" />
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.borrowerName || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{r.borrowerPhone || "—"}</td>
                  {showFull && (() => {
                    const b = getBankerFieldsFromBankRecord(r);
                    return (
                      <>
                        <td style={{ padding: "10px 12px" }}>
                          {formatBankerTableCell(b.banker1Name, "name")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {formatBankerTableCell(b.banker1Phone, "phone")}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                          {r.loanAccountNumber || b.loanNumber || "—"}
                        </td>
                      </>
                    );
                  })()}
                  <td style={{ padding: "10px 12px" }}>
                    {r.outstandingAmount != null
                      ? Number(r.outstandingAmount).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  {showFull && (
                    <>
                      <td style={{ padding: "10px 12px" }}>{r.branchName || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.bankId?.bankName || "—"}
                        {r.bankId?.bankCode && (
                          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>
                            ({r.bankId.bankCode})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{r.uploadedBy?.name || "—"}</td>
                    </>
                  )}
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background:
                          r.status === "active"
                            ? "#dcfce7"
                            : r.status === "assigned"
                            ? "#dbeafe"
                            : "#f3f4f6",
                        color:
                          r.status === "active"
                            ? "#166534"
                            : r.status === "assigned"
                            ? "#1e40af"
                            : "#374151",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      type="button"
                      className="secondary-page-btn bank-records-table__view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailId(r._id);
                      }}
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

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <button
            className="secondary-page-btn"
            disabled={page === 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary-page-btn"
            disabled={page === totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {detailId && (
        <BankRecordDetailModal
          recordId={detailId}
          fetchMode={isRepoAdmin ? "repo" : "agency"}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
