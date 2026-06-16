import { FiDownload } from "react-icons/fi";

export default function ExportExcelButton({
  onClick,
  loading = false,
  label = "Download Excel",
}) {
  return (
    <button
      type="button"
      className="btn-export-excel"
      onClick={onClick}
      disabled={loading}
    >
      <FiDownload aria-hidden />
      <span>{loading ? "Preparing…" : label}</span>
    </button>
  );
}
