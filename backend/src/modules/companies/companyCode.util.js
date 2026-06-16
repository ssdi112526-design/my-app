const CODE_START = 1111;

function extractPrefix(companyName) {
  const letters = String(companyName || "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();

  if (!letters.length) return "XXX";

  return letters.slice(0, 3).padEnd(3, "X");
}

async function generateNextCompanyCode(companyName, Company) {
  const prefix = extractPrefix(companyName);
  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");

  const companies = await Company.find({
    companyCode: { $regex: `^${prefix}\\d+$`, $options: "i" },
  }).select("companyCode");

  let maxNum = CODE_START - 1;

  for (const row of companies) {
    const match = String(row.companyCode || "").match(pattern);
    if (!match) continue;

    const num = parseInt(match[1], 10);
    if (Number.isFinite(num) && num >= CODE_START && num > maxNum) {
      maxNum = num;
    }
  }

  const nextNum = maxNum < CODE_START ? CODE_START : maxNum + 1;
  return `${prefix}${nextNum}`;
}

module.exports = {
  CODE_START,
  extractPrefix,
  generateNextCompanyCode,
};
