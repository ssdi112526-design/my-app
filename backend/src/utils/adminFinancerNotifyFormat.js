const { buildCanonicalAdminFinancerRows } = require("../constants/adminFinancerFields");

function safeValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  return String(value).trim();
}

/** Message rows in fixed SK financer field order. */
function buildAdminFinancerMessageRows(caseDoc = {}) {
  return buildCanonicalAdminFinancerRows(caseDoc, { strictLoanMobile: true }).map(
    ({ label, value }) => ({
      label,
      value: safeValue(value),
    })
  );
}

function appendAdminFinancerMessageBody(lines, caseDoc = {}) {
  buildAdminFinancerMessageRows(caseDoc).forEach(({ label, value }) => {
    lines.push(`${label}: ${safeValue(value)}`);
  });
  lines.push("");
}

module.exports = {
  buildAdminFinancerMessageRows,
  appendAdminFinancerMessageBody,
};
