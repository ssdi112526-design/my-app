import { Link, useSearchParams } from "react-router-dom";
import { getReturnLabel, getReturnPath } from "../../../utils/navReturn";
import { useCallback, useEffect, useMemo, useState } from "react";
import useAuth from "../../../hooks/useAuth";
import { companyBankService } from "../../../services/companyBank.service";
import { repoCaseService } from "../../../services/repoCase.service";
import BankRowUploadModal from "./BankRowUploadModal";
import BankUploadedViewModal from "./BankUploadedViewModal";
import { emitDashboardRefresh } from "../../../utils/dashboardEvents";
import "../../../styles/bankDetails.css";
import "../../../styles/confirmation.css";
import "../../../styles/users.css";
import "../../../styles/uploadRecords.css";

function branchUploadKey(bankName, branchName) {
  return `${(bankName || "").trim().toLowerCase()}|||${(branchName || "").trim().toLowerCase()}`;
}

function formatUploadDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BankDetails() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnPath(searchParams);
  const returnLabel = getReturnLabel(returnTo);

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [uploadTarget, setUploadTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [uploads, setUploads] = useState([]);

  const loadBanks = useCallback(async () => {
    if (!auth?.token) return;

    try {
      setLoading(true);
      setLoadError("");
      const res = await companyBankService.getBanks(auth.token);
      const items = res?.data || [];
      setBanks(Array.isArray(items) ? items : []);
    } catch (err) {
      setLoadError(err?.response?.data?.message || "Failed to load bank details");
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  const loadUploads = useCallback(async () => {
    if (!auth?.token) return;

    try {
      const res = await repoCaseService.getUploadBatches(auth.token);
      const items = res?.data || [];
      setUploads(Array.isArray(items) ? items : []);
    } catch {
      setUploads([]);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadBanks();
    loadUploads();
  }, [loadBanks, loadUploads]);

  const uploadMap = useMemo(() => {
    const map = {};
    uploads.forEach((batch) => {
      const bn = batch.bankName?.trim();
      const br = batch.branchName?.trim();
      if (!bn || !br) return;
      const key = branchUploadKey(bn, br);
      const prev = map[key];
      const prevTime = prev?.createdAt ? new Date(prev.createdAt).getTime() : 0;
      const nextTime = batch.createdAt ? new Date(batch.createdAt).getTime() : 0;
      if (!prev || nextTime >= prevTime) map[key] = batch;
    });
    return map;
  }, [uploads]);

  const tableRows = useMemo(() => {
    const rows = [];
    banks.forEach((bank) => {
      const branches = (bank.branches || []).filter((br) => br.isActive !== false);
      if (branches.length === 0) {
        rows.push({
          key: `${bank._id}-empty`,
          bankId: bank._id,
          branchId: null,
          bankName: bank.bankName,
          branchName: "—",
          canUpload: false,
        });
        return;
      }
      branches.forEach((br) => {
        const upload = uploadMap[branchUploadKey(bank.bankName, br.name)] || null;
        rows.push({
          key: `${bank._id}-${br._id}`,
          bankId: bank._id,
          branchId: br._id,
          bankName: bank.bankName,
          branchName: br.name,
          canUpload: true,
          upload,
        });
      });
    });
    return rows;
  }, [banks, uploadMap]);

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormMessage("");

    const trimmedBank = bankName.trim();
    const trimmedBranch = branchName.trim();

    if (!trimmedBank) {
      setFormError("Bank name is required.");
      return;
    }
    if (!trimmedBranch) {
      setFormError("Branch name is required.");
      return;
    }

    setSaving(true);

    try {
      let bank = banks.find(
        (b) => b.bankName.toLowerCase() === trimmedBank.toLowerCase()
      );

      if (!bank) {
        const created = await companyBankService.createBank(
          { bankName: trimmedBank },
          auth.token
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
        await companyBankService.addBranch(
          bank._id,
          { name: trimmedBranch },
          auth.token
        );
      }

      setFormMessage("Bank details saved.");
      setBankName("");
      setBranchName("");
      await loadBanks();
    } catch (err) {
      setFormError(
        err?.response?.data?.message || err.message || "Failed to save bank details"
      );
    } finally {
      setSaving(false);
    }
  };

  const openUpload = (row) => {
    if (!row.canUpload) return;
    setUploadTarget({
      bankName: row.bankName,
      branchName: row.branchName,
    });
  };

  const openView = (row) => {
    if (!row.upload) return;
    setViewTarget({
      bankName: row.bankName,
      branchName: row.branchName,
      upload: row.upload,
    });
  };

  return (
    <div className="bd-page">
      <div className="cf-view-top">
        <Link to={returnTo} className="cf-view-back">
          ← Back to {returnLabel}
        </Link>
      </div>
      <div className="bd-header">
        <h1>Bank Details</h1>
        <p>
          Add bank and branch details. For large Excel uploads use{" "}
          Upload Records (banks &amp; branches on this page).
        </p>
      </div>

      <div className="bd-form-card">
        <form className="bd-form-grid" onSubmit={handleSaveBank}>
          <label className="bd-field">
            <span className="bd-label">Bank Name *</span>
            <input
              list="bd-bank-name-options"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Enter bank name"
              disabled={saving}
            />
            <datalist id="bd-bank-name-options">
              {banks.map((bank) => (
                <option key={bank._id} value={bank.bankName} />
              ))}
            </datalist>
          </label>

          <label className="bd-field">
            <span className="bd-label">Branch Name *</span>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="Enter branch name"
              disabled={saving}
            />
          </label>

          {formError && <p className="bd-feedback bd-error">{formError}</p>}
          {formMessage && <p className="bd-feedback bd-success">{formMessage}</p>}

          <div className="bd-form-actions">
            <button
              type="button"
              className="bd-btn bd-btn-secondary"
              disabled={saving}
              onClick={() => {
                setBankName("");
                setBranchName("");
                setFormError("");
                setFormMessage("");
              }}
            >
              Clear
            </button>
            <button type="submit" className="bd-btn bd-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Bank Details"}
            </button>
          </div>
        </form>
      </div>

      <div className="bd-table-card">
        <h2>Saved banks & branches</h2>

        {loadError && <p className="bd-feedback bd-error">{loadError}</p>}

        {loading ? (
          <p className="bd-muted">Loading…</p>
        ) : tableRows.length === 0 ? (
          <p className="bd-muted">No banks yet. Enter bank name and branch name above, then save.</p>
        ) : (
          <div className="company-table-wrap bd-excel-sheet">
            <table className="users-table excel-grid-table bd-excel-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Bank Name</th>
                  <th>Branch Name</th>
                  <th>Status</th>
                  <th>Date &amp; Time</th>
                  <th>Total Rows</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, index) => {
                  const isUploaded = Boolean(row.upload);
                  const uploadedAt = isUploaded
                    ? formatUploadDateTime(row.upload.createdAt)
                    : "";
                  const totalRows =
                    isUploaded && row.upload?.totalRows != null
                      ? Number(row.upload.totalRows)
                      : null;

                  return (
                    <tr key={row.key}>
                      <td>{index + 1}</td>
                      <td>{row.bankName}</td>
                      <td>{row.branchName}</td>
                      <td className="bd-col-status">
                        {!row.canUpload ? (
                          "—"
                        ) : isUploaded ? (
                          <button
                            type="button"
                            className="bd-status-badge bd-status-badge--uploaded"
                            onClick={() => openView(row)}
                          >
                            Uploaded
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="bd-status-badge bd-status-badge--upload"
                            onClick={() => openUpload(row)}
                          >
                            Upload
                          </button>
                        )}
                      </td>
                      <td className="bd-col-datetime">
                        {row.canUpload && isUploaded && uploadedAt ? (
                          <span className="bd-upload-meta">{uploadedAt}</span>
                        ) : row.canUpload && !isUploaded ? (
                          <span className="bd-upload-meta bd-upload-meta--pending">—</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="bd-col-rows">
                        {row.canUpload && isUploaded && totalRows != null && !Number.isNaN(totalRows) ? (
                          <span className="bd-upload-meta">
                            {totalRows} {totalRows === 1 ? "row" : "rows"}
                          </span>
                        ) : row.canUpload && !isUploaded ? (
                          <span className="bd-upload-meta bd-upload-meta--pending">—</span>
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
      </div>

      {uploadSuccess && (
        <p className="bd-feedback bd-success bd-page-success">{uploadSuccess}</p>
      )}

      <BankRowUploadModal
        open={Boolean(uploadTarget)}
        onClose={() => setUploadTarget(null)}
        token={auth?.token}
        bankName={uploadTarget?.bankName || ""}
        branchName={uploadTarget?.branchName || ""}
        onUploadSuccess={(batch) => {
          const fileName = batch?.fileName || "file";
          const successRows = batch?.successRows ?? 0;
          const totalRows = batch?.totalRows ?? 0;
          const replaced = Number(batch?.replacedPriorBatchCount || 0) > 0;
          if (batch?.importNote) {
            setUploadSuccess(batch.importNote);
          } else {
            setUploadSuccess(
              replaced
                ? `Upload complete: ${successRows} record(s) from ${fileName} (${totalRows} rows). Earlier data for this bank and branch was replaced.`
                : `Upload complete: ${successRows} record(s) from ${fileName} (${totalRows} rows).`
            );
          }
          setUploadTarget(null);
          loadUploads();
        }}
      />

      <BankUploadedViewModal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        upload={viewTarget?.upload}
        bankName={viewTarget?.bankName || ""}
        branchName={viewTarget?.branchName || ""}
        token={auth?.token}
        onReupload={(bn, br) => {
          setViewTarget(null);
          setUploadTarget({ bankName: bn, branchName: br });
        }}
        onDelete={({ bankName: bn, branchName: br, optimistic, failed }) => {
          if (failed) {
            loadUploads();
            setFormError(
              `Could not delete upload for ${bn} – ${br}. Please try again.`
            );
            return;
          }
          setViewTarget(null);
          const key = branchUploadKey(bn, br);
          if (optimistic) {
            setUploads((prev) =>
              prev.filter(
                (b) => branchUploadKey(b.bankName, b.branchName) !== key
              )
            );
            setUploadSuccess(
              `Upload removed for ${bn} – ${br}. Use Upload on the table to add a new file.`
            );
            emitDashboardRefresh();
            return;
          }
          loadUploads();
          emitDashboardRefresh();
        }}
      />

    </div>
  );
}
