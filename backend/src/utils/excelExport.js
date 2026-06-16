const xlsx = require("xlsx");

function buildWorkbookBuffer(rows, sheetName = "Sheet1") {
  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function sendExcelDownload(res, filename, rows, sheetName = "Sheet1") {
  const buffer = buildWorkbookBuffer(rows, sheetName);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/"/g, "")}"`
  );

  return res.send(buffer);
}

function formatDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

module.exports = {
  buildWorkbookBuffer,
  sendExcelDownload,
  formatDate,
};
