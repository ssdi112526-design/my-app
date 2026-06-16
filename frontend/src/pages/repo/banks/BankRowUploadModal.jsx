import { useEffect, useRef, useState } from "react";
import { uploadExcelViaS3 } from "../../../utils/uploadExcelViaS3";
import { waitForUploadBatch } from "../../../utils/uploadWait";

export default function BankRowUploadModal({
  open,
  onClose,
  token,
  bankName,
  branchName,
  onUploadSuccess,
}) {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [step, setStep] = useState("select");
  const [error, setError] = useState("");

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [fileRowCount, setFileRowCount] = useState(null);
  const [fileColumnCount, setFileColumnCount] = useState(null);
  const [processedRows, setProcessedRows] = useState(0);
  const [progressHint, setProgressHint] = useState("");

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setStep("select");
    setError("");
    setUploadedFileName("");
    setFileRowCount(null);
    setFileColumnCount(null);
    setProcessedRows(0);
    setProgressHint("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, bankName, branchName]);

  if (!open) return null;

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    setError("");
    setStep("select");
    setUploadedFileName(picked?.name || "");
    setFileRowCount(null);
    setFileColumnCount(null);
    setProcessedRows(0);
    setProgressHint("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an excel file first.");
      return;
    }

    setStep("uploading");
    setError("");
    setUploadedFileName(file.name);
    setProgressHint("Preparing fast S3 upload…");

    try {
      const { batchId, response } = await uploadExcelViaS3({
        file,
        bankName,
        branchName,
        token,
        onS3Progress: (loaded, total) => {
          if (total > 0) {
            const pct = Math.round((loaded / total) * 100);
            setProgressHint(`Uploading file to S3… ${pct}%`);
          }
        },
      });

      setProgressHint("File on S3. Worker processing…");

      const batch = response?.data;
      const id = batch?._id || batchId;

      if (!id) {
        throw new Error("Upload did not return a batch id.");
      }

      const done = await waitForUploadBatch(id, token, {
        onProgress: (b) => {
          if (b?.totalRows) setFileRowCount(b.totalRows);
          setProcessedRows(b?.processedRows || 0);
          if (b?.totalRows > 0) {
            const pct = Math.min(
              100,
              Math.round(((b.processedRows || 0) / b.totalRows) * 100)
            );
            setProgressHint(
              b.message ||
                `Processing… ${(b.processedRows || 0).toLocaleString()} / ${b.totalRows.toLocaleString()} (${pct}%)`
            );
          }
        },
      });

      if (onUploadSuccess) {
        onUploadSuccess({
          ...done,
          fileName: done?.fileName || file.name,
          bankName,
          branchName,
        });
      }

      if (done?.importNote) {
        setProgressHint(done.importNote);
        setStep("select");
        return;
      }

      onClose();
    } catch (err) {
      setStep("select");
      setError(err?.response?.data?.message || err.message || "Failed to upload records");
      setProgressHint("");
    }
  };

  const stepBoxes = [
    {
      key: "select",
      label: "Select file",
      action:
        file && step !== "uploading" ? (
          <span className="bd-step-file" title={uploadedFileName}>
            {uploadedFileName.length > 18
              ? `${uploadedFileName.slice(0, 18)}…`
              : uploadedFileName}
          </span>
        ) : (
          <button
            type="button"
            className="bd-step-link"
            disabled={step === "uploading"}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </button>
        ),
    },
    {
      key: "upload",
      label: step === "uploading" ? "Uploading…" : "Upload",
      action:
        step === "uploading" ? (
          <span className="bd-step-loading">Please wait</span>
        ) : (
          <button
            type="button"
            className="bd-step-link"
            disabled={!file}
            onClick={handleUpload}
          >
            Start upload
          </button>
        ),
    },
    {
      key: "done",
      label: "Done",
      action:
        step === "uploading" ? (
          <span className="bd-step-verified">Processing…</span>
        ) : (
          <span className="bd-step-pending">—</span>
        ),
    },
  ];

  const boxActive = (key) => {
    if (key === "select") return step === "select" && !file;
    if (key === "upload") return step === "select" && file;
    if (key === "done") return step === "uploading";
    return false;
  };

  const boxComplete = (key) => {
    if (key === "select") return Boolean(file);
    if (key === "upload") return step === "uploading";
    return false;
  };

  const showInfoBoxes = Boolean(uploadedFileName) && step === "uploading";

  return (
    <div
      className="modal-overlay bd-upload-modal-overlay"
      role="presentation"
      onClick={step === "uploading" ? undefined : onClose}
    >
      <div
        className="modal-box bd-upload-modal bd-upload-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-upload-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="bd-upload-modal-title">Upload records</h3>
        <p className="modal-subtitle">
          <strong>{bankName}</strong> — {branchName}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="ur-file-input-hidden"
          onChange={handleFileChange}
        />

        <div className="bd-step-track">
          {stepBoxes.map((box, index) => (
            <div key={box.key} className="bd-step-track-item">
              {index > 0 && (
                <div
                  className={`bd-step-line ${
                    step === "uploading" && index === 1 ? "bd-step-line--active" : ""
                  } ${boxComplete(stepBoxes[index - 1].key) ? "bd-step-line--done" : ""}`}
                />
              )}
              <div
                className={`bd-step-box ${
                  boxActive(box.key) ? "bd-step-box--active" : ""
                } ${boxComplete(box.key) ? "bd-step-box--done" : ""}`}
              >
                <span className="bd-step-box-label">{box.label}</span>
                <div className="bd-step-box-action">{box.action}</div>
              </div>
            </div>
          ))}
        </div>

        {showInfoBoxes && (
          <div className="bd-verify-info-boxes">
            <div className="bd-info-box bd-info-box--filename">
              <span className="bd-info-label">File name</span>
              <span className="bd-info-value" title={uploadedFileName}>
                {uploadedFileName}
              </span>
            </div>
            <div className="bd-info-box">
              <span className="bd-info-label">Rows</span>
              <span className="bd-info-value">
                {fileRowCount != null
                  ? processedRows > 0
                    ? `${processedRows.toLocaleString()} / ${fileRowCount.toLocaleString()}`
                    : fileRowCount.toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="bd-info-box">
              <span className="bd-info-label">Columns</span>
              <span className="bd-info-value">{fileColumnCount ?? "—"}</span>
            </div>
          </div>
        )}

        {progressHint && step === "uploading" && (
          <p className="bd-upload-progress-hint">{progressHint}</p>
        )}

        {error && <p className="bd-feedback bd-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-page-btn"
            onClick={onClose}
            disabled={step === "uploading"}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
