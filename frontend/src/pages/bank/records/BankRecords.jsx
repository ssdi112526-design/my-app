import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiUpload,
  FiSearch,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
} from "react-icons/fi";
import bankService from "../../../services/bank.service";
import BankRecordDetailModal from "../../../components/bank/BankRecordDetailModal";
import VehicleNumberPlate from "../../../components/bank/VehicleNumberPlate";
import { useBankExcelUpload } from "../../../hooks/useBankExcelUpload";
import "../../../styles/uploadRecords.css";
import "../../../styles/bankRecordDetail.css";

function UploadProgressBar({ percent }) {
  return (
    <div
      style={{
        margin: "12px 0",
        background: "#e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        height: 10,
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          background: "var(--accent,#2563eb)",
          height: "100%",
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

function BatchStatusCard({ batch, onDismiss }) {
  if (!batch) return null;
  const isProcessing = batch.status === "processing";
  const isFailed = batch.status === "failed";
  const isDone = batch.status === "completed";
  const pct =
    batch.totalRows > 0 ? Math.round((batch.processedRows / batch.totalRows) * 100) : null;

  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: 8,
        border: `1px solid ${isDone ? "#bbf7d0" : isFailed ? "#fecaca" : "#bfdbfe"}`,
        background: isDone ? "#f0fdf4" : isFailed ? "#fef2f2" : "#eff6ff",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isProcessing && <FiLoader size={16} style={{ animation: "spin 1s linear infinite" }} />}
        {isDone && <FiCheckCircle size={16} color="#16a34a" />}
        {isFailed && <FiAlertCircle size={16} color="#dc2626" />}
        <strong style={{ fontSize: 14 }}>
          {isProcessing ? "Processing upload…" : isDone ? "Upload complete" : "Upload failed"}
        </strong>
        {!isProcessing && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "#6b7280",
            }}
          >
            ×
          </button>
        )}
      </div>
      {isProcessing && pct !== null && (
        <>
          <UploadProgressBar percent={pct} />
          <p style={{ fontSize: 12, color: "#4b5563", margin: 0 }}>
            {batch.processedRows?.toLocaleString()} / {batch.totalRows?.toLocaleString()} rows
          </p>
        </>
      )}
      {isDone && (
        <p style={{ fontSize: 13, color: "#166534", marginTop: 6, marginBottom: 0 }}>
          ✓ {batch.successRows?.toLocaleString()} rows imported
          {batch.failedRows > 0 && ` · ${batch.failedRows} skipped`}
          {batch.duplicateRows > 0 && ` · ${batch.duplicateRows} duplicates`}
        </p>
      )}
      {isFailed && (
        <p style={{ fontSize: 13, color: "#991b1b", marginTop: 6, marginBottom: 0 }}>
          {batch.errorMessage || "Processing failed"}
        </p>
      )}
    </div>
  );
}

export default function BankRecords() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const fileRef = useRef(null);
  const LIMIT = 30;

  const loadRecords = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await bankService.getRecords({
        page: p,
        limit: LIMIT,
        search: s || undefined,
      });
      setRecords(res?.data?.data?.records || []);
      setTotal(res?.data?.data?.total || 0);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const {
    uploadStage,
    uploadProgress,
    uploadError,
    setUploadError,
    activeBatch,
    dismissBatch,
    uploadFile,
    uploadButtonLabel,
    isBusy,
  } = useBankExcelUpload({
    onComplete: () => loadRecords(1, search),
  });

  useEffect(() => {
    loadRecords(page, search);
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadRecords(1, search);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (file) uploadFile(file);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2>Recovery Records</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/bank/files" className="secondary-page-btn">
            Manage uploaded files
          </Link>
          <button
            type="button"
            className="primary-page-btn"
            disabled={isBusy}
            onClick={() => fileRef.current?.click()}
          >
            <FiUpload style={{ marginRight: 6 }} />
            {uploadButtonLabel()}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileSelect} />
        </div>
      </div>

      {uploadStage === "uploading" && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, marginBottom: 4, color: "#374151" }}>
            Uploading… {uploadProgress}%
          </p>
          <UploadProgressBar percent={uploadProgress} />
        </div>
      )}

      {activeBatch && <BatchStatusCard batch={activeBatch} onDismiss={dismissBatch} />}

      {uploadError && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <p style={{ color: "#991b1b", fontSize: 13, margin: 0 }}>{uploadError}</p>
          <button
            type="button"
            onClick={() => setUploadError("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
          >
            ×
          </button>
        </div>
      )}

      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
        Browse imported Excel data below. Open a row for full sheet columns. To remove an upload,
        use <Link to="/bank/files">Uploaded Files</Link> in the sidebar.
      </p>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vehicle, borrower, loan, mobile no…"
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

      <p className="muted" style={{ marginBottom: 12 }}>
        {total.toLocaleString()} records
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          <FiUpload size={36} style={{ opacity: 0.3 }} />
          <p style={{ marginTop: 12 }}>No records yet.</p>
          <p style={{ fontSize: 13 }}>
            <Link to="/bank/files">Upload an Excel file</Link> to import data.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--table-head-bg,#f9fafb)", textAlign: "left" }}>
                {[
                  "Vehicle No",
                  "Borrower",
                  "Phone",
                  "Loan Account",
                  "Outstanding",
                  "Branch",
                  "Uploaded By",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h || "actions"}
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
                  <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                    {r.loanAccountNumber || "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.outstandingAmount != null
                      ? `₹${Number(r.outstandingAmount).toLocaleString("en-IN")}`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{r.branchName || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{r.uploadedBy?.name || "—"}</td>
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
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary-page-btn"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {detailId && (
        <BankRecordDetailModal
          recordId={detailId}
          fetchMode="bank"
          onClose={() => setDetailId(null)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
