/**
 * Normalize vehicle registration values from Excel cells (text or numeric).
 * Keeps the full registration on one logical token (no 10-char truncation).
 */

function sanitizeVehicleFromExcel(value) {
  if (value == null) return "";

  let s = String(value).trim();
  if (!s) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1e8 && value < 1e12) {
      s = String(Math.round(value));
    }
  }

  if (/^\d+\.0+$/.test(s)) {
    s = String(Math.round(Number(s)));
  }

  if (/e\+/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }

  return s
    .replace(/[\s\-_.]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 13);
}

module.exports = { sanitizeVehicleFromExcel };
