const fs = require("fs");
const path = require("path");

const UPLOADS_ROOT = path.join(__dirname, "../../uploads");
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extForMime(mimetype, originalName) {
  const fromName = path.extname(originalName || "");
  if (fromName) return fromName.toLowerCase();
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/gif") return ".gif";
  return ".jpg";
}

function saveProfileImage(file, folder, entityId) {
  if (!file?.buffer?.length) {
    throw new Error("No image file provided.");
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new Error("Invalid image. Use JPEG, PNG, or WebP.");
  }

  const ext = extForMime(file.mimetype, file.originalname);
  const relDir = path.join("profiles", folder).replace(/\\/g, "/");
  const dir = path.join(UPLOADS_ROOT, "profiles", folder);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${String(entityId)}${ext}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, file.buffer);

  return `${relDir}/${filename}`.replace(/\\/g, "/");
}

function publicUploadUrl(relativePath) {
  if (!relativePath) return "";
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `/uploads/${String(relativePath).replace(/^\/+/, "")}`;
}

module.exports = {
  saveProfileImage,
  publicUploadUrl,
  ALLOWED_MIME,
};
