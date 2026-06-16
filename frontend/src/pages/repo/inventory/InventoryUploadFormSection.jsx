import InventoryUploadField from "./InventoryUploadField";
import {
  INVENTORY_UPLOAD_LIMITS,
  capInventoryFiles,
  inventoryFileKey,
  mergeInventoryFiles,
  remainingInventorySlots,
} from "./inventoryUploadUtils";

export default function InventoryUploadFormSection({
  confirmation,
  imageFiles,
  videoFiles,
  pdfFiles,
  setImageFiles,
  setVideoFiles,
  setPdfFiles,
  submitting,
  success,
  onSubmit,
  title = "Upload inventory pre/post",
  intro,
  submitLabel = "Submit inventory",
}) {
  const existingImages = confirmation?.inventoryImages?.length || 0;
  const existingVideos = confirmation?.inventoryVideos?.length || 0;
  const existingPdfs = confirmation?.inventoryPdfs?.length || 0;

  const roomForImages = remainingInventorySlots(
    existingImages + imageFiles.length,
    INVENTORY_UPLOAD_LIMITS.images
  );
  const roomForVideos = remainingInventorySlots(
    existingVideos + videoFiles.length,
    INVENTORY_UPLOAD_LIMITS.videos
  );
  const roomForPdfs = remainingInventorySlots(
    existingPdfs + pdfFiles.length,
    INVENTORY_UPLOAD_LIMITS.pdfs
  );

  const addFiles = (setter, existingCount, limit, incoming) => {
    setter((prev) => {
      const room = remainingInventorySlots(existingCount + prev.length, limit);
      const merged = mergeInventoryFiles(prev, incoming);
      const { files, trimmed } = capInventoryFiles(merged, room);
      if (trimmed > 0) {
        alert("File limit reached for this type. Extra file(s) were not added.");
      }
      return files;
    });
  };

  const removeFile = (setter, file) => {
    const key = inventoryFileKey(file);
    setter((prev) => prev.filter((item) => inventoryFileKey(item) !== key));
  };

  const atCapacity = roomForImages === 0 && roomForVideos === 0 && roomForPdfs === 0;

  return (
    <form className="inv-form" onSubmit={onSubmit}>
      <h3 className="inv-section-title">{title}</h3>
      {intro && <p className="inv-upload-intro">{intro}</p>}

      {atCapacity ? (
        <p className="inv-upload-intro inv-upload-intro--muted">
          Maximum file limits reached. Contact your admin if you need to replace files.
        </p>
      ) : (
        <div className="inv-upload-grid">
          {roomForImages > 0 && (
            <InventoryUploadField
              label="Images"
              accept="image/*"
              hint={`${existingImages} already saved · add up to ${roomForImages} more`}
              maxCount={roomForImages}
              files={imageFiles}
              disabled={submitting}
              onAdd={(picked) =>
                addFiles(setImageFiles, existingImages, INVENTORY_UPLOAD_LIMITS.images, picked)
              }
              onRemove={(file) => removeFile(setImageFiles, file)}
            />
          )}
          {roomForVideos > 0 && (
            <InventoryUploadField
              label="Videos"
              accept="video/*"
              hint={`${existingVideos} already saved · add up to ${roomForVideos} more`}
              maxCount={roomForVideos}
              files={videoFiles}
              disabled={submitting}
              onAdd={(picked) =>
                addFiles(setVideoFiles, existingVideos, INVENTORY_UPLOAD_LIMITS.videos, picked)
              }
              onRemove={(file) => removeFile(setVideoFiles, file)}
            />
          )}
          {roomForPdfs > 0 && (
            <InventoryUploadField
              label="PDF documents"
              accept="application/pdf,.pdf"
              hint={`${existingPdfs} already saved · add up to ${roomForPdfs} more`}
              maxCount={roomForPdfs}
              files={pdfFiles}
              disabled={submitting}
              onAdd={(picked) =>
                addFiles(setPdfFiles, existingPdfs, INVENTORY_UPLOAD_LIMITS.pdfs, picked)
              }
              onRemove={(file) => removeFile(setPdfFiles, file)}
            />
          )}
        </div>
      )}

      {success && <p className="inv-success">{success}</p>}

      {!atCapacity && (
        <div className="inv-form-actions">
          <button type="submit" className="inv-submit" disabled={submitting}>
            {submitting ? "Uploading…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
