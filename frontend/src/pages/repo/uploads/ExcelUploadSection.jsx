import { useMemo, useRef, useEffect, useState } from "react";
import { companyBankService } from "../../../services/companyBank.service";
import { repoCaseService } from "../../../services/repoCase.service";
import { pollUploadUntilDone } from "../../../utils/uploadPoll";
import { uploadExcelViaS3 } from "../../../utils/uploadExcelViaS3";
import { waitForUploadBatch } from "../../../utils/uploadWait";
import { emitDashboardRefresh } from "../../../utils/dashboardEvents";

const REQUIRED_HINT =
  "Each row needs customer name and at least loan account number or vehicle number.";

export default function ExcelUploadSection({
  token,
  banks,
  onBanksReload,
  hideBankDetailsForm = false,
  fileInputId = "excelFileInput",
  sectionTitle = "Upload records (Excel)",
  initialBankId = "",
  initialBranchName = "",
}) {
  const fileInputRef = useRef(null);
  const didApplyInitialSelection = useRef(false);

  useEffect(() => {
    didApplyInitialSelection.current = false;
  }, [initialBankId, initialBranchName]);

  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [file, setFile] = useState(null);

  const [preview, setPreview] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [uploadedFileName, setUploadedFileName] = useState("");
  const [fileRowCount, setFileRowCount] = useState(null);
  const [fileColumnCount, setFileColumnCount] = useState(null);

  const [newBankName, setNewBankName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [bankFormError, setBankFormError] = useState("");

  useEffect(() => {
    if (didApplyInitialSelection.current) return;
    if (!initialBankId || !Array.isArray(banks) || banks.length === 0) return;
    const bank = banks.find((b) => String(b._id) === String(initialBankId));
    if (!bank) return;
    setSelectedBankId(bank._id);
    if (initialBranchName) {
      const norm = (s) => String(s || "").trim().toLowerCase();
      const br = (bank.branches || []).find(
        (x) => norm(x.name) === norm(initialBranchName)
      );
      if (br) setSelectedBranch(br.name);
    }
    didApplyInitialSelection.current = true;
  }, [initialBankId, initialBranchName, banks]);

  const selectedBank = useMemo(
    () => banks.find((b) => b._id === selectedBankId) || null,
    [banks, selectedBankId]
  );

  const activeBranches = useMemo(
    () => (selectedBank?.branches || []).filter((br) => br.isActive !== false),
    [selectedBank]
  );

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    setBankFormError("");

    const trimmedBank = newBankName.trim();
    const trimmedBranch = newBranchName.trim();

    if (!trimmedBank) {
      setBankFormError("Bank name is required.");
      return;
    }
    if (!trimmedBranch) {
      setBankFormError("Branch name is required.");
      return;
    }

    setBankSaving(true);

    try {
      let bank = banks.find(
        (b) => b.bankName.toLowerCase() === trimmedBank.toLowerCase()
      );

      if (!bank) {
        const created = await companyBankService.createBank(
          { bankName: trimmedBank },
          token
        );
        bank = created?.data;
      }

      if (!bank?._id) {
        throw new Error("Could not resolve bank.");
      }

      const hasBranch = (bank.branches || []).some(
        (br) =>
          br.name.toLowerCase() === trimmedBranch.toLowerCase() &&
          br.isActive !== false
      );

      if (!hasBranch) {
        await companyBankService.addBranch(bank._id, { name: trimmedBranch }, token);
      }

      setNewBankName("");
      setNewBranchName("");
      if (onBanksReload) await onBanksReload();

      setSelectedBankId(bank._id);
      setSelectedBranch(trimmedBranch);
    } catch (err) {
      setBankFormError(
        err?.response?.data?.message || err.message || "Failed to save bank details"
      );
    } finally {
      setBankSaving(false);
    }
  };

  const resetUploadState = () => {
    setFile(null);
    setPreview(null);
    setColumnMapping({});
    setSelectedBranch("");
    setUploadedFileName("");
    setFileRowCount(null);
    setFileColumnCount(null);
    setError("");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBankChange = (e) => {
    setSelectedBankId(e.target.value);
    setSelectedBranch("");
    setPreview(null);
    setColumnMapping({});
    setFile(null);
    setUploadedFileName("");
    setFileRowCount(null);
    setFileColumnCount(null);
    setError("");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runPreview = async (picked) => {
    if (!selectedBank) {
      setError("Please select a bank for upload first.");
      return;
    }

    setPreviewLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("bankName", selectedBank.bankName);
      formData.append("file", picked);

      const res = await repoCaseService.previewCasesExcel(formData, token);
      const data = res?.data;

      setPreview(data);
      setColumnMapping(data?.suggestedMapping || {});
      setUploadedFileName(picked.name);
      setFileRowCount(data?.totalRows ?? null);
      setFileColumnCount(data?.columns?.length ?? null);
    } catch (err) {
      setPreview(null);
      setError(err?.response?.data?.message || "Failed to preview excel file");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    setPreview(null);
    setColumnMapping({});
    setMessage("");

    if (!picked) {
      setUploadedFileName("");
      setFileRowCount(null);
      setFileColumnCount(null);
      return;
    }

    await runPreview(picked);
  };

  const handleMappingChange = (fieldKey, excelColumn) => {
    setColumnMapping((prev) => ({
      ...prev,
      [fieldKey]: excelColumn,
    }));
  };

  const handleUpload = async () => {
    if (!selectedBank) {
      setError("Please select a bank.");
      return;
    }
    if (!file) {
      setError("Please choose an excel file.");
      return;
    }
    if (!selectedBranch) {
      setError("Please select a branch for this upload.");
      return;
    }
    if (!preview) {
      setError("Please verify the file first (select excel file).");
      return;
    }

    setUploadLoading(true);
    setError("");
    setMessage("");

    try {
      setMessage("Uploading file to S3…");

      const { batchId, response } = await uploadExcelViaS3({
        file,
        bankName: selectedBank.bankName,
        branchName: selectedBranch,
        columnMapping,
        token,
        onS3Progress: (loaded, total) => {
          if (total > 0) {
            const pct = Math.round((loaded / total) * 100);
            setMessage(`Uploading to S3… ${pct}%`);
          }
        },
      });

      let batch = response?.data;

      if (response?.processing && batchId) {
        setMessage("File on S3. Worker processing…");
        batch = await waitForUploadBatch(batchId, token, {
          onProgress: (b) => {
            if (b?.totalRows) setFileRowCount(b.totalRows);
            setMessage(
              b?.totalRows
                ? `Importing… ${(b.processedRows || 0).toLocaleString()} / ${b.totalRows.toLocaleString()} rows`
                : "Importing rows…"
            );
          },
        });
      } else if (batch?.status === "completed") {
        emitDashboardRefresh({ batchId, batch });
      }

      setUploadedFileName(file.name);
      setFileRowCount(batch?.totalRows ?? fileRowCount);
      setFileColumnCount(preview?.columns?.length ?? fileColumnCount);

      const replaced = Number(batch?.replacedPriorBatchCount || 0) > 0;
      const invalidLoan = Number(batch?.skippedInvalidLoanRows || 0);
      const failExtra = invalidLoan
        ? ` (${invalidLoan} row(s) skipped: missing or invalid loan number — use LAN/VL in Loan Number column, not a 10-digit mobile)`
        : "";
      const baseMsg = `Upload completed. File: ${file.name}. Rows: ${batch?.totalRows || 0}, Imported: ${batch?.successRows || 0}, Skipped: ${batch?.failedRows || 0}${failExtra}, Duplicate: ${batch?.duplicateRows || 0}.`;
      setMessage(
        replaced
          ? `${baseMsg} Earlier data for this bank and branch was replaced.`
          : baseMsg
      );

      if (onBanksReload) onBanksReload();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to upload excel");
    } finally {
      setUploadLoading(false);
    }
  };

  const systemFields = preview?.systemFields || [];
  const columns = preview?.columns || [];
  const canPickFile = Boolean(selectedBankId);

  return (
    <div className={`ur-form-card ur-upload-section ${hideBankDetailsForm ? "" : "ur-upload-section--with-bank-form"}`}>
      <h3 className="ur-upload-section-title">{sectionTitle}</h3>

      <div className="ur-wizard-steps">
        <span className="ur-step">1. Select bank & branch</span>
        <span className="ur-step">2. Excel file & verify</span>
        <span className="ur-step">3. Map & upload</span>
      </div>

      {!hideBankDetailsForm && (
        <div className="ur-bank-details-block">
          <h4>Add bank details</h4>
          <p className="ur-muted">Enter bank and branch, then save to database.</p>
          <form className="ur-form-grid ur-bank-details-grid" onSubmit={handleSaveBankDetails}>
            <label className="ur-form-row">
              <div className="ur-label">Bank Name *</div>
              <input
                list="excel-bank-name-options"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="Enter bank name"
                disabled={bankSaving}
              />
              <datalist id="excel-bank-name-options">
                {banks.map((bank) => (
                  <option key={bank._id} value={bank.bankName} />
                ))}
              </datalist>
            </label>

            <label className="ur-form-row">
              <div className="ur-label">Branch Name *</div>
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Enter branch name"
                disabled={bankSaving}
              />
            </label>

            {bankFormError && (
              <p className="ur-feedback ur-error ur-form-row-full">{bankFormError}</p>
            )}

            <div className="ur-form-actions ur-bank-details-actions">
              <button
                type="button"
                className="ur-btn ur-btn-secondary"
                disabled={bankSaving}
                onClick={() => {
                  setNewBankName("");
                  setNewBranchName("");
                  setBankFormError("");
                }}
              >
                Clear
              </button>
              <button type="submit" className="ur-btn ur-btn-primary" disabled={bankSaving}>
                {bankSaving ? "Saving…" : "Save Bank Details"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="ur-form-grid">
        <label className="ur-form-row">
          <div className="ur-label">Bank for upload *</div>
          <select value={selectedBankId} onChange={handleBankChange}>
            <option value="">Select bank…</option>
            {banks.map((bank) => (
              <option key={bank._id} value={bank._id}>
                {bank.bankName}
              </option>
            ))}
          </select>
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Branch for upload *</div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={!selectedBankId}
          >
            <option value="">Select branch…</option>
            {activeBranches.map((br) => (
              <option key={br._id} value={br.name}>
                {br.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ur-form-row ur-form-row-full ur-file-pick-row">
          <div className="ur-label">Excel file *</div>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".xlsx,.xls"
            className="ur-file-input-hidden"
            disabled={!canPickFile || previewLoading}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="ur-btn ur-btn-primary"
            disabled={!canPickFile || previewLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewLoading ? "Verifying file…" : "Select Excel file"}
          </button>
          {!canPickFile && (
            <p className="ur-muted ur-file-hint">Select a bank first, then choose your excel file.</p>
          )}
        </div>

        <label className="ur-form-row">
          <div className="ur-label">Uploaded file name</div>
          <input readOnly value={uploadedFileName || "—"} placeholder="No file selected" />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Rows in excel file</div>
          <input
            readOnly
            value={fileRowCount != null ? String(fileRowCount) : "—"}
            placeholder="—"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Columns in excel file</div>
          <input
            readOnly
            value={fileColumnCount != null ? String(fileColumnCount) : "—"}
            placeholder="—"
          />
        </label>

        {previewLoading && (
          <p className="ur-feedback ur-form-row-full">Reading and verifying file…</p>
        )}

        {preview && (
          <>
            <p className="ur-note ur-form-row-full">
              Verified {preview.totalRows} row(s), {columns.length} column(s). {REQUIRED_HINT}
            </p>

            <div className="ur-form-row-full ur-mapping-wrap">
              <h4>Column mapping</h4>
              <table className="ur-mapping-table">
                <thead>
                  <tr>
                    <th>System field</th>
                    <th>Excel column</th>
                  </tr>
                </thead>
                <tbody>
                  {systemFields.map((field) => (
                    <tr key={field.key}>
                      <td>
                        {field.label}
                        {field.required ? " *" : ""}
                      </td>
                      <td>
                        <select
                          value={columnMapping[field.key] || ""}
                          onChange={(e) =>
                            handleMappingChange(field.key, e.target.value)
                          }
                        >
                          <option value="">— Not mapped —</option>
                          {columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ur-form-row-full ur-preview-wrap">
              <h4>Preview (first {preview.previewRows?.length || 0} rows)</h4>
              <div className="ur-preview-table-scroll">
                <table className="ur-preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Customer</th>
                      <th>Mobile</th>
                      <th>Loan #</th>
                      <th>Vehicle</th>
                      <th>Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.previewRows || []).map((row) => {
                      const n = row.normalized || {};
                      const valid =
                        !!n.customerName && (!!n.loanAccountNumber || !!n.vehicleNumber);
                      return (
                        <tr key={row.rowNumber} className={valid ? "" : "ur-row-invalid"}>
                          <td>{row.rowNumber}</td>
                          <td>{n.customerName || "—"}</td>
                          <td>{n.mobileNumber || "—"}</td>
                          <td>{n.loanAccountNumber || "—"}</td>
                          <td>{n.vehicleNumber || "—"}</td>
                          <td>{valid ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {error && <p className="ur-feedback ur-error ur-form-row-full">{error}</p>}
        {message && <p className="ur-feedback ur-success ur-form-row-full">{message}</p>}

        <div className="ur-form-actions">
          <button
            type="button"
            className="ur-btn ur-btn-secondary"
            disabled={uploadLoading}
            onClick={resetUploadState}
          >
            Reset
          </button>
          <button
            type="button"
            className="ur-btn ur-btn-primary"
            disabled={uploadLoading || !preview || !selectedBranch}
            onClick={handleUpload}
          >
            {uploadLoading ? "Uploading…" : "Upload to database"}
          </button>
        </div>
      </div>
    </div>
  );
}
