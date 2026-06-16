import {
  normalizeChassis,
  normalizeVehicleNumber,
  VEHICLE_NUMBER_MAX_LENGTH,
} from "../../../utils/vehicleNumberUtils";

export const MIN_SEARCH_CHARS = 4;
export const MIN_PHONE_SEARCH_DIGITS = 6;
export const VEHICLE_SEARCH_MAX_CHARS = VEHICLE_NUMBER_MAX_LENGTH;
export const CHASSIS_SEARCH_MAX_CHARS = 25;
export const PHONE_SEARCH_MAX_CHARS = 15;

/** Allow full mobile numbers in the vehicle search field (digits only). */
export function sanitizeVehicleOrPhoneInput(value, maxLen = VEHICLE_SEARCH_MAX_CHARS) {
  const raw = String(value || "");
  if (isPhoneLikeSearch(raw)) {
    return digitsOnly(raw).slice(0, PHONE_SEARCH_MAX_CHARS);
  }
  return raw
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, maxLen);
}

/** @deprecated Use VEHICLE_SEARCH_MAX_CHARS / CHASSIS_SEARCH_MAX_CHARS */
export const SEARCH_INPUT_MAX_CHARS = VEHICLE_SEARCH_MAX_CHARS;

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/** True when the query looks like a mobile / phone number (6+ digits). */
export function isPhoneLikeSearch(value) {
  const d = digitsOnly(value);
  return d.length >= MIN_PHONE_SEARCH_DIGITS;
}

/** Pick vehicle vs chassis vs phone when inputs meet min length. */
export function resolveActiveSearch(draftVehicle, draftChassis, preference) {
  const vNorm = normalizeVehicleNumber(draftVehicle);
  const cNorm = normalizeChassis(draftChassis);
  const vDigits = digitsOnly(draftVehicle);

  if (isPhoneLikeSearch(draftVehicle) && vDigits.length >= MIN_PHONE_SEARCH_DIGITS) {
    return { mode: "phone", normalized: vDigits };
  }

  if (vNorm.length >= MIN_SEARCH_CHARS && cNorm.length >= MIN_SEARCH_CHARS) {
    return preference === "chassis"
      ? { mode: "chassis", normalized: cNorm }
      : { mode: "vehicle", normalized: vNorm };
  }
  if (vNorm.length >= MIN_SEARCH_CHARS) {
    return { mode: "vehicle", normalized: vNorm };
  }
  if (cNorm.length >= MIN_SEARCH_CHARS) {
    return { mode: "chassis", normalized: cNorm };
  }
  return null;
}

/** True when id is a MongoDB ObjectId (real repo case, not Excel-only placeholder). */
export function isMongoCaseId(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || ""));
}

export const getItems = (response) => {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export const safeValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return value;
};

export const getFullAddress = (item) => {
  const parts = [
    item.addressLine1,
    item.addressLine2,
    item.city,
    item.state,
    item.pincode,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "-";
};

export const getShareMessage = (item) => {
  return `Vehicle Confirmation Request

Customer Name: ${safeValue(item.customerName)}
Mobile Number: ${safeValue(item.mobileNumber)}
Alternate Mobile Number: ${safeValue(item.alternateMobileNumber)}
Vehicle Number: ${safeValue(item.vehicleNumber)}
Engine Number: ${safeValue(item.engineNumber)}
Chassis Number: ${safeValue(item.chassisNumber)}
Reference Number: ${safeValue(item.referenceNumber)}
Case Code: ${safeValue(item.caseCode)}
Vehicle Brand: ${safeValue(item.vehicleBrand)}
Vehicle Model: ${safeValue(item.vehicleModel)}
Full Address: ${getFullAddress(item)}
City: ${safeValue(item.city)}
State: ${safeValue(item.state)}
Pincode: ${safeValue(item.pincode)}
Confirmation Status: ${safeValue(item.confirmationStatus || "PENDING")}
Loaded details: ${safeValue(item.loadedDetail || item.loadedShort)}
`;
};
