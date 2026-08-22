const path = require("path");
const {
  MAX_UPLOAD_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ALLOWED_UPLOAD_EXTENSIONS,
} = require("./upload.constants");

function uploadFileExtension(fileName) {
  return path.extname(String(fileName || "")).toLowerCase();
}

function isAllowedUploadFileName(fileName) {
  return ALLOWED_UPLOAD_EXTENSIONS.includes(uploadFileExtension(fileName));
}

function uploadFileTooLarge(bytes) {
  const n = Number(bytes);
  return Number.isFinite(n) && n > MAX_UPLOAD_FILE_SIZE_BYTES;
}

function oversizedUploadMessage() {
  return `File exceeds the ${MAX_UPLOAD_FILE_SIZE_MB} MB upload limit.`;
}

function rejectUploadFile(fileName, sizeBytes) {
  if (fileName && !isAllowedUploadFileName(fileName)) {
    return "Only .xlsx, .xls, and .csv files are allowed.";
  }
  if (sizeBytes != null && uploadFileTooLarge(sizeBytes)) {
    return oversizedUploadMessage();
  }
  return "";
}

module.exports = {
  isAllowedUploadFileName,
  uploadFileTooLarge,
  oversizedUploadMessage,
  rejectUploadFile,
  MAX_UPLOAD_FILE_SIZE_BYTES,
};
