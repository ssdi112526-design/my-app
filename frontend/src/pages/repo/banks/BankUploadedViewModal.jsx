import { useEffect, useState } from "react";
import { repoCaseService } from "../../../services/repoCase.service";
import {
  formatFieldsLabel,
  getExcelColumnNames,
  getExcelFieldCount,
} from "../../../utils/uploadFieldUtils";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BankUploadedViewModal({
  open,
  onClose,
  upload,
  bankName,
  branchName,
  token,
  onReupload,
  onDelete,
}) {
  const [openingFile, setOpeningFile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [fileError, setFileError] = useState("");
  const [vehicleItems, setVehicleItems] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState("");

  useEffect(() => {
    if (!open || !upload?._id || !token) {
      setVehicleItems([]);
      setVehiclesError("");
      return undefined;
    }

    let cancelled = false;

    const loadVehicles = async () => {
      setLoadingVehicles(true);
      setVehiclesError("");
      try {
        const res = await repoCaseService.getUploadVehicleNumbers(upload._id, token);
        if (!cancelled) {
          setVehicleItems(Array.isArray(res?.items) ? res.items : []);
        }
      } catch (err) {
        if (!cancelled) {
          setVehicleItems([]);
          setVehiclesError(
            err?.response?.data?.message || "Could not load vehicle numbers."
          );
        }
      } finally {
        if (!cancelled) setLoadingVehicles(false);
      }
    };

    loadVehicles();
    return () => {
      cancelled = true;
    };
  }, [open, upload?._id, token]);

  if (!open || !upload) return null;

  const fieldCount = getExcelFieldCount(upload);
  const columnNames = getExcelColumnNames(upload);
  const fieldsLabel = formatFieldsLabel(fieldCount);

  const uploader =
    upload.uploadedBy?.name ||
    upload.uploadedBy?.email ||
    (typeof upload.uploadedBy === "string" ? upload.uploadedBy : "—");

  const canOpenFile = Boolean(upload._id && upload.storedFilePath);

  const handleDelete = async () => {
    if (!upload._id || !token || deleting) return;

    const confirmed = window.confirm(
      `Delete all upload data for ${bankName} – ${branchName}?\n\nThe Excel file and search data will be removed from S3. You can upload again from the Bank Details table.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");

    try {
      if (typeof onDelete === "function") {
        onDelete({ bankName, branchName, optimistic: true });
      }
      await repoCaseService.deleteUploadBatch(upload._id, token);
    } catch (err) {
      if (typeof onDelete === "function") {
        onDelete({ bankName, branchName, failed: true });
      }
      setDeleteError(
        err?.response?.data?.message || "Could not delete upload. Try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenFile = async () => {
    if (!upload._id || !token) return;

    setOpeningFile(true);
    setFileError("");

    try {
      await repoCaseService.openUploadFile(upload._id, token);
    } catch (err) {
      setFileError(
        err?.response?.data?.message || "Could not open file. Try uploading again."
      );
    } finally {
      setOpeningFile(false);
    }
  };

  return (
    <div className="modal-overlay bd-upload-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-box bd-upload-modal bd-upload-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-upload-view-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="bd-upload-view-title">Uploaded file</h3>
        <p className="modal-subtitle">
          <strong>{bankName}</strong> — {branchName}
        </p>

        <div className="bd-verify-info-boxes bd-verify-info-boxes--view">
          <div className="bd-info-box bd-info-box--wide">
            <span className="bd-info-label">File name</span>
            {upload.fileName ? (
              canOpenFile ? (
                <button
                  type="button"
                  className="bd-file-link"
                  onClick={handleOpenFile}
                  disabled={openingFile}
                  title="Open Excel file"
                >
                  {openingFile ? "Opening…" : upload.fileName}
                </button>
              ) : (
                <span className="bd-info-value" title="File not stored for this upload">
                  {upload.fileName}
                </span>
              )
            ) : (
              <span className="bd-info-value">—</span>
            )}
            {fileError && <p className="bd-file-error">{fileError}</p>}
          </div>
          <div className="bd-info-box">
            <span className="bd-info-label">Total rows</span>
            <span className="bd-info-value">{upload.totalRows ?? "—"}</span>
          </div>
          <div className="bd-info-box bd-info-box--wide">
            <span className="bd-info-label">Fields in Excel sheet</span>
            <span className="bd-info-value">{fieldsLabel || "—"}</span>
            {columnNames.length > 0 && (
              <ul className="bd-column-names">
                {columnNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="bd-info-box">
            <span className="bd-info-label">Date & time uploaded</span>
            <span className="bd-info-value">{formatDateTime(upload.createdAt)}</span>
          </div>
          <div className="bd-info-box">
            <span className="bd-info-label">Success</span>
            <span className="bd-info-value bd-info-value--success">
              {upload.successRows ?? 0}
            </span>
          </div>
          <div className="bd-info-box">
            <span className="bd-info-label">Failed</span>
            <span className="bd-info-value">{upload.failedRows ?? 0}</span>
          </div>
          <div className="bd-info-box">
            <span className="bd-info-label">Duplicate</span>
            <span className="bd-info-value">{upload.duplicateRows ?? 0}</span>
          </div>
          <div className="bd-info-box bd-info-box--wide">
            <span className="bd-info-label">Uploaded by</span>
            <span className="bd-info-value">{uploader}</span>
          </div>
        </div>

        <div className="bd-upload-vehicles-section">
          <div className="bd-upload-vehicles-head">
            <h4>Vehicle numbers from this Excel</h4>
            {!loadingVehicles && vehicleItems.length > 0 && (
              <span className="bd-upload-vehicles-count">
                {vehicleItems.length} number(s)
              </span>
            )}
          </div>
          {loadingVehicles && (
            <p className="bd-upload-vehicles-hint">Loading vehicle numbers…</p>
          )}
          {!loadingVehicles && vehiclesError && (
            <p className="bd-file-error">{vehiclesError}</p>
          )}
          {!loadingVehicles && !vehiclesError && vehicleItems.length === 0 && (
            <p className="bd-upload-vehicles-hint">
              No vehicle numbers saved from this file. Check that the Excel has a
              Vehicle Number column and rows were not failed or duplicate.
            </p>
          )}
          {!loadingVehicles && vehicleItems.length > 0 && (
            <div className="bd-upload-vehicles-grid">
              {vehicleItems.map((item) => (
                <div key={item._id || item.vehicleNumber} className="bd-upload-vehicle-card">
                  <span className="bd-upload-vehicle-plate">
                    {formatVehicleNumberDisplay(item.vehicleNumber)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {Array.isArray(upload.failedDetails) && upload.failedDetails.length > 0 && (
          <div className="bd-failed-wrap">
            <h4>Failed rows (sample)</h4>
            <ul className="bd-failed-list">
              {upload.failedDetails.slice(0, 8).map((item) => (
                <li key={`${item.rowNumber}-${item.reason}`}>
                  Row {item.rowNumber}: {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bd-upload-actions-block">
          <p className="bd-upload-actions-text">
            Upload a new Excel file to <strong>replace</strong> this branch data, or{" "}
            <strong>delete</strong> everything from S3 and start fresh with Upload on the table.
          </p>
          {deleteError && <p className="bd-file-error">{deleteError}</p>}
          <div className="bd-upload-actions-row">
            <button
              type="button"
              className="bd-btn bd-btn-primary bd-btn-reupload"
              disabled={deleting}
              onClick={() => {
                if (typeof onReupload === "function") {
                  onReupload(bankName, branchName);
                }
              }}
            >
              Reupload Excel
            </button>
            <button
              type="button"
              className="bd-btn bd-btn-danger"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete upload"}
            </button>
          </div>
        </div>

        <div className="modal-actions bd-view-modal-actions">
          <button type="button" className="secondary-page-btn" onClick={onClose} disabled={deleting}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
