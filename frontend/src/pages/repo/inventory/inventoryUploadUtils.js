export const INVENTORY_UPLOAD_LIMITS = {
  images: 30,
  videos: 15,
  pdfs: 15,
};

export function inventoryFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function mergeInventoryFiles(existing, incoming) {
  const map = new Map((existing || []).map((file) => [inventoryFileKey(file), file]));
  (incoming || []).forEach((file) => map.set(inventoryFileKey(file), file));
  return Array.from(map.values());
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function capInventoryFiles(files, maxCount) {
  if (files.length <= maxCount) return { files, trimmed: 0 };
  return { files: files.slice(0, maxCount), trimmed: files.length - maxCount };
}

/** How many more files of this type can still be uploaded (server total cap). */
export function remainingInventorySlots(existingCount, maxCount) {
  return Math.max(0, maxCount - (existingCount || 0));
}
