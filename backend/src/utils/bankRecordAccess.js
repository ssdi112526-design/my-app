const BankRepoLink = require("../modules/bank/bankRepoLink.model");
const User = require("../modules/users/user.model");

/** Bank IDs linked to this repo company (via its REPO_ADMIN). */
async function getLinkedBankIdsForCompany(companyId) {
  if (!companyId) return [];
  const admin = await User.findOne({
    companyId,
    role: "REPO_ADMIN",
    isActive: true,
  }).select("_id");
  if (!admin) return [];

  const links = await BankRepoLink.find({
    repoAdminId: admin._id,
    isActive: true,
  }).select("bankId");

  return [...new Set(links.map((l) => String(l.bankId)).filter(Boolean))];
}

async function companyHasLinkedBank(companyId, bankId) {
  const ids = await getLinkedBankIdsForCompany(companyId);
  return ids.includes(String(bankId));
}

module.exports = {
  getLinkedBankIdsForCompany,
  companyHasLinkedBank,
};
