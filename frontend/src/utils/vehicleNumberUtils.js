/** Indian registration style e.g. UP80EU1212, MH12AB1234 */
const INDIAN_VEHICLE_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

/** Max normalized length for a stored/searchable vehicle number (e.g. UP80EU1212 = 10). */
export const VEHICLE_NUMBER_MAX_LENGTH = 10;

export function normalizeVehicleNumber(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

export function isValidIndianVehicleNumber(value) {
  const normalized = normalizeVehicleNumber(value);
  return INDIAN_VEHICLE_REGEX.test(normalized);
}

/** Any vehicle number saved from Excel / repo case (4–10 chars after normalize). */
export function hasUploadedVehicleNumber(value) {
  const normalized = normalizeVehicleNumber(value);
  return (
    normalized.length >= 4 &&
    normalized.length <= VEHICLE_NUMBER_MAX_LENGTH &&
    /^[A-Z0-9]+$/.test(normalized)
  );
}

export function filterValidVehicleRecords(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      ...item,
      vehicleNumber: normalizeVehicleNumber(item.vehicleNumber),
    }))
    .filter((item) => hasUploadedVehicleNumber(item.vehicleNumber));
}

export function sanitizeVehicleInput(value, maxLen = VEHICLE_NUMBER_MAX_LENGTH) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, maxLen);
}

/** Chassis: letters, digits, hyphen */
export function sanitizeChassisInput(value, maxLen = 25) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9\-]/g, "")
    .toUpperCase()
    .slice(0, maxLen);
}

export function normalizeChassis(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .toUpperCase();
}

/**
 * Indian plate display on a single line, e.g. UP80EU1212 → UP 80 EU 1212
 * Supports classic and BH-series style lengths up to 13 chars.
 */
export function formatVehicleNumberDisplay(value) {
  const normalized = normalizeVehicleNumber(value);
  if (!normalized) return "—";

  const patterns = [
    /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/,
    /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/,
  ];

  for (const re of patterns) {
    const match = normalized.match(re);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }

  return normalized;
}
