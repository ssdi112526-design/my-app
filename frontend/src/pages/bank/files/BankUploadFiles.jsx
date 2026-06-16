import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiUpload,
  FiTrash2,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
} from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import bankService from "../../../services/bank.service";
import { useBankExcelUpload } from "../../../hooks/useBankExcelUpload";
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

function StatusBadge({ status }) {
  const map = {
    completed: { bg: "#dcfce7", color: "#166534", label: "Completed" },
    processing: { bg: "#dbeafe", color: "#1e40af", label: "Processing" },
    failed: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
  };
  const s = map[status] || { bg: "#f3f4f6", color: "#374151", label: status || "—" };
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
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
      className="bank-files-status-card"
      style={{
        padding: "14px 18px",
        borderRadius: 8,
        border: `1px solid ${isDone ? "#bbf7d0" : isFailed ? "#fecaca" : "#bfdbfe"}`,
        background: isDone ? "#f0fdf4" : isFailed ? "#fef2f2" : "#eff6ff",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isProcessing && <FiLoader size={16} className="bank-files-spin" />}
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
              fontSize: 18,
              color: "#6b7280",
            }}
            aria-label="Dismiss"
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
        <p style={{ fontSize: 13, color: "#166534", marginTop: 8, marginBottom: 0 }}>
          {batch.successRows?.toLocaleString()} rows imported.
          {" "}
          <Link to="/bank/records">View records</Link>
        </p>
      )}
      {isFailed && (
        <p style={{ fontSize: 13, color: "#991b1b", marginTop: 8, marginBottom: 0 }}>
          {batch.errorMessage || "Processing failed"}
        </p>
      )}
    </div>
  );
}

export default function BankUploadFiles() {
  const { auth } = useAuth();
  const isAdmin = auth?.user?.role === "BANK_ADMIN";
  const fileRef = useRef(null);

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState(null);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bankService.listUploads();
      setBatches(res?.data?.data?.batches || []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    onComplete: () => loadBatches(),
  });

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (file) uploadFile(file);
  };

  const handleDeleteBatch = async (batch) => {
    if (!batch?._id) return;
    const rows = batch.successRows ?? 0;
    if (
      !window.confirm(
        `Delete file "${batch.fileName}" and all ${rows > 0 ? rows.toLocaleString() : ""} imported row(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingBatchId(batch._id);
    try {
      const res = await bankService.deleteBatchRecords(batch._id);
      const data = res?.data?.data || {};
      const n = Number(data.deleted) || 0;
      const removed = data.batchRemoved !== false;
      const msg = res?.data?.message;
      if (removed) {
        window.alert(
          n > 0
            ? `${n.toLocaleString()} case(s) deleted from your bank and from all linked repo agencies.\n\n${msg || ""}`
            : "Upload file removed from your list."
        );
      } else {
        window.alert(msg || "Delete completed.");
      }
      await loadBatches();
      if (activeBatch?._id === batch._id) dismissBatch();
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 403
          ? "You can only delete files you uploaded."
          : "Could not delete file. Try again or contact support.");
      window.alert(msg);
    } finally {
      setDeletingBatchId(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="page bank-files-page">
      <div className="bank-files-page__header">
        <div>
          <h2>Uploaded Files</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            All Excel files you have uploaded. Delete a file to remove its rows from Records.
            {isAdmin ? " Bank admins see every upload in the bank." : " You only see your own files."}
          </p>
        </div>
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

      {uploadStage === "uploading" && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Uploading to storage… {uploadProgress}%</p>
          <UploadProgressBar percent={uploadProgress} />
        </div>
      )}

      <BatchStatusCard batch={activeBatch} onDismiss={dismissBatch} />

      {uploadError && (
        <div className="bank-files-error">
          <p>{uploadError}</p>
          <button type="button" onClick={() => setUploadError("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <p className="muted bank-files-page__hint">
        Large files (400k+ rows) are processed in the background. Open{" "}
        <Link to="/bank/records">Records</Link> to browse imported data in table form.
      </p>

      {loading ? (
        <p className="muted">Loading files…</p>
      ) : batches.length === 0 ? (
        <div className="bank-files-empty">
          <FiFileText size={40} style={{ opacity: 0.25 }} />
          <p>No Excel files uploaded yet.</p>
          <button
            type="button"
            className="primary-page-btn"
            disabled={isBusy}
            onClick={() => fileRef.current?.click()}
          >
            <FiUpload /> Upload your first file
          </button>
        </div>
      ) : (
        <div className="bank-files-table-wrap">
          <table className="bank-files-table">
            <thead>
              <tr>
                <th>File name</th>
                <th>Uploaded</th>
                <th>Uploaded by</th>
                <th>Rows imported</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch._id}>
                  <td className="bank-files-table__name">
                    <FiFileText style={{ flexShrink: 0, opacity: 0.5 }} />
                    <span title={batch.fileName}>{batch.fileName}</span>
                  </td>
                  <td>{formatDate(batch.createdAt)}</td>
                  <td>{batch.uploadedBy?.name || "—"}</td>
                  <td>{batch.successRows != null ? batch.successRows.toLocaleString("en-IN") : "—"}</td>
                  <td>
                    <StatusBadge status={batch.status} />
                  </td>
                  <td>
                    <div className="bank-files-table__actions">
                      {batch.status === "completed" && batch.successRows > 0 && (
                        <Link
                          to="/bank/records"
                          className="secondary-page-btn"
                          style={{ fontSize: 12 }}
                        >
                          View data
                        </Link>
                      )}
                      <button
                        type="button"
                        className="secondary-page-btn bank-files-table__delete"
                        disabled={deletingBatchId === batch._id || batch.status === "processing"}
                        onClick={() => handleDeleteBatch(batch)}
                        title={
                          batch.status === "processing"
                            ? "Wait until processing finishes"
                            : "Delete file and all imported rows"
                        }
                      >
                        <FiTrash2 />
                        {deletingBatchId === batch._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .bank-files-spin { animation: bank-files-spin 1s linear infinite; }
        @keyframes bank-files-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
