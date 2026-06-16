function formatBlockedDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export default function ViewBlockReasonModal({
  open,
  companyName,
  blockReason,
  blockedAt,
  onClose,
  onUnblock,
  unblocking = false,
}) {
  if (!open) {
    return null;
  }

  const reason = (blockReason || "").trim() || "No reason recorded.";
  const blockedLabel = formatBlockedDate(blockedAt);

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={unblocking ? undefined : onClose}
    >
      <div
        className="modal-box block-company-modal view-block-reason-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-block-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="view-block-reason-title">Block reason</h3>
        <p className="modal-subtitle">
          Why <strong>{companyName || "this company"}</strong> was blocked.
        </p>

        {blockedLabel && (
          <p className="view-block-reason-meta">
            Blocked on: <strong>{blockedLabel}</strong>
          </p>
        )}

        <label className="modal-label" htmlFor="view-block-reason-text">
          Reason
        </label>
        <textarea
          id="view-block-reason-text"
          className="modal-textarea modal-textarea--readonly"
          value={reason}
          readOnly
          rows={5}
        />

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-page-btn"
            onClick={onClose}
            disabled={unblocking}
          >
            Close
          </button>
          {onUnblock && (
            <button
              type="button"
              className="primary-page-btn company-btn--unblock modal-btn-unblock"
              onClick={onUnblock}
              disabled={unblocking}
            >
              {unblocking ? "Unblocking…" : "Unblock company"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
