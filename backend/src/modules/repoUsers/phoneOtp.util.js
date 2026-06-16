const crypto = require("crypto");

const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;

/** Fixed OTP for local/testing when SMS is not configured. */
const DEV_FIXED_OTP = "123456";

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function verifyOtpHash(code, hash) {
  return hashOtp(code) === hash;
}

function isDevFixedOtp(code) {
  return String(code || "").trim() === DEV_FIXED_OTP;
}

/** Always returns the fixed test OTP (no SMS). */
function getOtpCodeForSend() {
  return DEV_FIXED_OTP;
}

module.exports = {
  OTP_TTL_MS,
  VERIFIED_TTL_MS,
  DEV_FIXED_OTP,
  normalizePhone,
  generateOtpCode,
  getOtpCodeForSend,
  isDevFixedOtp,
  hashOtp,
  verifyOtpHash,
};
