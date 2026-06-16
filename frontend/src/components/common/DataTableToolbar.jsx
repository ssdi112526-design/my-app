import { FiDownload, FiPrinter } from "react-icons/fi";

export default function DataTableToolbar({
  onDownloadExcel,
  onPrint,
  downloading = false,
  downloadLabel = "Download Excel (.xlsx)",
  children = null,
}) {
  return (
    <div
      className="table-data-toolbar"
      role="toolbar"
      aria-label="Export and print"
    >
      <p className="table-data-toolbar__hint">
        Save this list to your computer or print it.
      </p>
      <div className="table-data-toolbar__actions">
        <button
          type="button"
          className="btn-table-excel"
          onClick={onDownloadExcel}
          disabled={downloading}
        >
          <FiDownload aria-hidden />
          <span>{downloading ? "Preparing file…" : downloadLabel}</span>
        </button>
        <button type="button" className="btn-table-print" onClick={onPrint}>
          <FiPrinter aria-hidden />
          <span>Print</span>
        </button>
        {children}
      </div>
    </div>
  );
}
