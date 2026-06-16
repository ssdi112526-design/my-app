const { sanitizeVehicleFromExcel } = require("./vehicleExcelNormalize");

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Excel storage keys used for banker / customer mobiles on bank uploads. */
const EXTRA_PHONE_KEYS = [
  "mobile no",
  "mobile no 1",
  "mobile no_1",
  "mobile no 2",
  "mobile no_2",
  "mobile no 3",
  "mobile no_3",
  "customer mobile",
  "borrower mobile",
  "phone",
  "phone number",
];

/**
 * Build MongoDB filter for bank record list search (vehicle, name, loan, phones).
 * @returns {object|null} `{ $or: [...] }` or null when search empty
 */
function buildBankRecordSearchFilter(search) {
  const trimmed = String(search || "").trim();
  if (!trimmed) return null;

  const regex = { $regex: escapeRegex(trimmed), $options: "i" };
  const or = [
    { vehicleNumber: regex },
    { borrowerName: regex },
    { loanAccountNumber: regex },
    { borrowerPhone: regex },
    { chassisNumber: regex },
    { engineNumber: regex },
  ];

  const vehicleNorm = sanitizeVehicleFromExcel(trimmed);
  if (vehicleNorm && vehicleNorm !== trimmed) {
    or.push({
      vehicleNumber: { $regex: escapeRegex(vehicleNorm), $options: "i" },
    });
  }

  for (const key of EXTRA_PHONE_KEYS) {
    or.push({ [`extraFields.${key}`]: regex });
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 6) {
    const digitRegex = { $regex: escapeRegex(digits), $options: "i" };
    or.push({ borrowerPhone: digitRegex });
    for (const key of EXTRA_PHONE_KEYS) {
      or.push({ [`extraFields.${key}`]: digitRegex });
    }
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      const last10Regex = { $regex: escapeRegex(last10), $options: "i" };
      or.push({ borrowerPhone: last10Regex });
      for (const key of EXTRA_PHONE_KEYS) {
        or.push({ [`extraFields.${key}`]: last10Regex });
      }
    }
  }

  return { $or: or };
}

module.exports = {
  buildBankRecordSearchFilter,
  escapeRegex,
};
