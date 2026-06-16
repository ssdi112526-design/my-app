import { formatFileSize, inventoryFileKey } from "./inventoryUploadUtils";

export default function InventoryUploadField({
  label,
  accept,
  hint,
  maxCount,
  files,
  onAdd,
  onRemove,
  disabled,
}) {
  const handleChange = (event) => {
    const picked = Array.from(event.target.files || []);
    if (picked.length) onAdd(picked);
    event.target.value = "";
  };

  return (
    <div className="inv-upload-field">
      <span>{label}</span>
      <p className="inv-upload-hint">{hint}</p>
      <input
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        onChange={handleChange}
      />
      <p className="inv-upload-count">
        {files.length} / {maxCount} selected
        {files.length < maxCount ? " — tap Choose files again to add more" : " (limit reached)"}
      </p>
      {files.length > 0 && (
        <ul className="inv-pending-files">
          {files.map((file) => (
            <li key={inventoryFileKey(file)} className="inv-pending-files__item">
              <span className="inv-pending-files__name" title={file.name}>
                {file.name}
              </span>
              <span className="inv-pending-files__size">{formatFileSize(file.size)}</span>
              <button
                type="button"
                className="inv-pending-files__remove"
                disabled={disabled}
                onClick={() => onRemove(file)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
