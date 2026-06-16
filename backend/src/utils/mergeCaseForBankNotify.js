const BANKER_CASE_KEYS = [
  "contactPerson1Name",
  "contactPerson1Phone",
  "contactPerson2Name",
  "contactPerson2Phone",
  "contactPerson3Name",
  "contactPerson3Phone",
  "bankNotifyEmail1",
  "bankNotifyEmail2",
  "loanAccountNumber",
  "vehicleNumber",
  "chassisNumber",
  "engineNumber",
  "customerName",
  "vehicleBrand",
  "vehicleModel",
  "bankName",
  "branchName",
  "loadedDetail",
  "loadedShort",
];

function hasText(value) {
  return String(value || "").trim().length > 0;
}

/**
 * Merge Mongo case + search/S3 row so banker columns from Excel are available for bank notify.
 */
function mergeCaseForBankNotify(primary = {}, ...fallbacks) {
  const base =
    primary && typeof primary === "object" ? { ...primary } : {};

  const excelFields = { ...(base.excelFields || {}) };

  for (const fb of fallbacks) {
    if (!fb || typeof fb !== "object") continue;

    for (const key of BANKER_CASE_KEYS) {
      if (!hasText(base[key]) && hasText(fb[key])) {
        base[key] = fb[key];
      }
    }

    if (fb.excelFields && typeof fb.excelFields === "object") {
      Object.assign(excelFields, fb.excelFields);
    }
  }

  base.excelFields = excelFields;
  return base;
}

module.exports = {
  mergeCaseForBankNotify,
};
