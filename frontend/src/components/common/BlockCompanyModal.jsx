import { useEffect, useState } from "react";

export default function BlockCompanyModal({
  open,
  companyName,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 3 && !loading;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="modal-box block-company-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-company-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="block-company-title">Block company</h3>
        <p className="modal-subtitle">
          Why are you blocking <strong>{companyName || "this company"}</strong>?
          This reason will be shown on the blocked companies list.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="modal-label" htmlFor="block-reason">
            Block reason
          </label>
          <textarea
            id="block-reason"
            className="modal-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Non-payment, policy violation, fraudulent activity..."
            rows={4}
            maxLength={500}
            disabled={loading}
            autoFocus
          />
          <p className="modal-hint">{trimmed.length}/500 (minimum 3 characters)</p>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-page-btn"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-page-btn modal-btn-danger"
              disabled={!canSubmit}
            >
              {loading ? "Blocking…" : "Block company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
