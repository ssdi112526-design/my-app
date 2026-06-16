const apiBase = process.env.REACT_APP_API_BASE_URL || "/api";
const uploadsBase =
  (process.env.REACT_APP_BACKEND_URL
    ? process.env.REACT_APP_BACKEND_URL.replace(/\/$/, "")
    : apiBase.startsWith("http")
      ? apiBase.replace(/\/api\/?$/, "")
      : "") + "/uploads";

export default function InventoryFilesGallery({ confirmation }) {
  const images = confirmation?.inventoryImages || [];
  const videos = confirmation?.inventoryVideos || [];
  const pdfs = confirmation?.inventoryPdfs || [];

  if (!images.length && !videos.length && !pdfs.length) {
    return <p className="lrms-section__hint">No inventory files uploaded yet.</p>;
  }

  return (
    <div className="inv-existing lrms-inventory-gallery">
      {images.length > 0 && (
        <div className="inv-file-group">
          <span className="inv-file-label">Images</span>
          <div className="inv-file-grid">
            {images.map((file, index) => (
              <a
                key={`img-${index}`}
                href={`${uploadsBase}/${file}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src={`${uploadsBase}/${file}`} alt={`Inventory ${index + 1}`} />
              </a>
            ))}
          </div>
        </div>
      )}
      {videos.length > 0 && (
        <div className="inv-file-group">
          <span className="inv-file-label">Videos</span>
          <ul>
            {videos.map((file, index) => (
              <li key={`vid-${index}`}>
                <a href={`${uploadsBase}/${file}`} target="_blank" rel="noreferrer">
                  Video {index + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pdfs.length > 0 && (
        <div className="inv-file-group">
          <span className="inv-file-label">PDFs</span>
          <ul>
            {pdfs.map((file, index) => (
              <li key={`pdf-${index}`}>
                <a href={`${uploadsBase}/${file}`} target="_blank" rel="noreferrer">
                  PDF {index + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
