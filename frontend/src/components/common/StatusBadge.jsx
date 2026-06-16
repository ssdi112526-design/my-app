function formatStatusLabel(status) {
  if (!status) return "—";
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * @param {{ status?: string, variant?: 'success' | 'warning' | 'danger' | 'neutral', className?: string }} props
 */
export default function StatusBadge({ status, variant = "neutral", className = "" }) {
  const safeVariant = ["success", "warning", "danger", "neutral"].includes(variant)
    ? variant
    : "neutral";

  return (
    <span
      className={`status-badge status-badge--${safeVariant}${className ? ` ${className}` : ""}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
