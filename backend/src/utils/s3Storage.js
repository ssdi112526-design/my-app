const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let s3Client = null;

function isS3Configured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
  );
}

function getS3Client() {
  if (!isS3Configured()) {
    throw new Error(
      "AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in backend/.env"
    );
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      followRegionRedirects: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

function getUploadPrefix() {
  const raw = String(process.env.AWS_S3_UPLOAD_PREFIX || "uploads").trim();
  return raw.replace(/^\/+|\/+$/g, "");
}

function buildObjectKey(companyId, batchId, originalName) {
  const path = require("path");
  const ext = path.extname(originalName || "") || ".xlsx";
  const prefix = getUploadPrefix();
  return `${prefix}/${String(companyId)}/${String(batchId)}${ext}`;
}

/** Full parsed upload dataset (JSON, gzip) — primary row archive in S3 */
function buildDatasetJsonKey(companyId, batchId) {
  const prefix = getUploadPrefix();
  return `${prefix}/${String(companyId)}/${String(batchId)}/data.json.gz`;
}

/** Compact row index for fast vehicle search (gzip JSON). */
function buildSearchIndexKey(companyId, batchId) {
  const prefix = getUploadPrefix();
  return `${prefix}/${String(companyId)}/${String(batchId)}/search-index.json.gz`;
}

async function uploadBufferToS3({ key, buffer, contentType, originalName }) {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      Metadata: {
        originalname: String(originalName || "").slice(0, 200),
      },
    })
  );

  return { bucket, key };
}

async function getObjectStreamFromS3(key) {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET;

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}
async function deleteObjectFromS3(key) {
  if (!key || !isS3Configured()) return;

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    })
  );
}

/** Delete many S3 keys in parallel (up to 1000 per API call). */
async function deleteObjectsFromS3(keys) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  if (!unique.length || !isS3Configured()) return { deleted: 0 };

  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET;
  let deleted = 0;

  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    deleted += (result.Deleted || []).length;
  }

  return { deleted };
}

/** Browser uploads file directly to S3 (fast — skips Node server). */
async function createPresignedPutUrl(key, contentType, expiresIn = 3600) {
  const client = getS3Client();
  const bucket = process.env.AWS_S3_BUCKET;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return { uploadUrl, bucket, key, expiresIn };
}

async function getObjectBufferFromS3(key) {
  const { stream } = await getObjectStreamFromS3(key);
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

module.exports = {
  isS3Configured,
  buildObjectKey,
  buildDatasetJsonKey,
  buildSearchIndexKey,
  uploadBufferToS3,
  createPresignedPutUrl,
  getObjectStreamFromS3,
  getObjectBufferFromS3,
  deleteObjectFromS3,
  deleteObjectsFromS3,
};
