const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const {
  isS3Configured,
  buildObjectKey,
  buildDatasetJsonKey,
  buildSearchIndexKey,
  uploadBufferToS3,
  getObjectStreamFromS3,
  deleteObjectsFromS3,
} = require("../../utils/s3Storage");

const UPLOAD_ROOT = path.join(__dirname, "../../../uploads");

const MIME_BY_EXT = {
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
};

function assertS3Required() {
  if (!isS3Configured()) {
    throw new Error(
      "Upload storage requires AWS S3. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in backend/.env"
    );
  }
}

const getMimeType = (fileName) => {
  const ext = path.extname(fileName || "").toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
};

/** Excel file → S3 only (no local disk). */
const saveUploadFile = async (companyId, batchId, originalName, buffer) => {
  assertS3Required();

  const key = buildObjectKey(companyId, batchId, originalName);
  await uploadBufferToS3({
    key,
    buffer,
    contentType: getMimeType(originalName),
    originalName,
  });

  return { storedFilePath: key, storageLocation: "s3" };
};

/** Parsed rows + metadata → S3 as gzip JSON (full upload data archive). */
const saveUploadDatasetToS3 = async (companyId, batchId, dataset) => {
  assertS3Required();

  const key = buildDatasetJsonKey(companyId, batchId);
  const jsonBuffer = Buffer.from(JSON.stringify(dataset), "utf8");
  const compressed = await gzip(jsonBuffer);

  await uploadBufferToS3({
    key,
    buffer: compressed,
    contentType: "application/gzip",
    originalName: "data.json.gz",
  });

  return { s3DatasetKey: key };
};

const saveSearchIndexToS3 = async (companyId, batchId, rows) => {
  assertS3Required();

  const key = buildSearchIndexKey(companyId, batchId);
  const jsonBuffer = Buffer.from(
    JSON.stringify({
      version: 1,
      rowCount: rows.length,
      rows,
    }),
    "utf8"
  );
  const compressed = await gzip(jsonBuffer);

  await uploadBufferToS3({
    key,
    buffer: compressed,
    contentType: "application/gzip",
    originalName: "search-index.json.gz",
  });

  return { s3SearchIndexKey: key };
};

const loadUploadDatasetFromS3 = async (key) => {
  assertS3Required();

  const { stream } = await getObjectStreamFromS3(key);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const compressed = Buffer.concat(chunks);
  const jsonBuffer = await gunzip(compressed);
  return JSON.parse(jsonBuffer.toString("utf8"));
};

const loadSearchIndexFromS3 = async (key) => {
  const data = await loadUploadDatasetFromS3(key);
  return Array.isArray(data?.rows) ? data.rows : [];
};

const deleteUploadFile = async (batch) => {
  const {
    storedFilePath,
    s3DatasetKey,
    s3SearchIndexKey,
    storageLocation,
  } = batch || {};
  const loc = storageLocation || "s3";

  if (loc === "s3") {
    const keys = [storedFilePath, s3DatasetKey, s3SearchIndexKey].filter(Boolean);
    if (!keys.length) return;
    try {
      await deleteObjectsFromS3(keys);
    } catch (err) {
      console.error("Could not remove S3 upload files:", err.message);
    }
    return;
  }

  if (!storedFilePath) return;
  const fullPath = path.join(UPLOAD_ROOT, storedFilePath);
  if (fs.existsSync(fullPath)) {
    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      console.error("Could not remove local upload file:", err.message);
    }
  }
};

const pipeUploadFileToResponse = async (doc, res) => {
  const fileName = doc.fileName || "upload.xlsx";
  const mimeType = getMimeType(fileName);

  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(fileName)}"`
  );

  if (doc.storageLocation === "s3" && doc.storedFilePath) {
    const { stream, contentType } = await getObjectStreamFromS3(
      doc.storedFilePath
    );
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    stream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message });
      } else {
        res.end();
      }
    });
    return stream.pipe(res);
  }

  return false;
};

module.exports = {
  UPLOAD_ROOT,
  getMimeType,
  saveUploadFile,
  saveUploadDatasetToS3,
  saveSearchIndexToS3,
  loadUploadDatasetFromS3,
  loadSearchIndexFromS3,
  deleteUploadFile,
  pipeUploadFileToResponse,
  isS3Configured,
  assertS3Required,
};
