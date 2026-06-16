export function getExcelColumnNames(upload) {
  if (!upload) return [];
  if (Array.isArray(upload.columnNames)) {
    return upload.columnNames
      .map((name) => String(name).trim())
      .filter((name) => name !== "");
  }
  return [];
}

export function getExcelFieldCount(upload) {
  const names = getExcelColumnNames(upload);
  if (names.length > 0) return names.length;

  const count = Number(upload?.columnCount);
  if (!Number.isNaN(count) && count > 0) return count;

  return null;
}

export function formatFieldsLabel(count) {
  if (count == null) return "";
  return `${count} ${count === 1 ? "field" : "fields"}`;
}
