const CompanyBank = require("../modules/companyBanks/companyBank.model");
const { escapeRegex } = require("../utils/bankNotifyDispatch");
const { buildRecipientOptions } = require("../utils/excelNotifyContacts");

/**
 * Bank / branch authority contacts configured under Banks (not customer mobile).
 */
async function resolveBankBranchContacts(companyId, bankName, branchName, overrides = {}) {
  const bn = String(bankName || "").trim();
  const brn = String(branchName || "").trim();

  let branchMatch = null;
  if (bn) {
    const bankDoc = await CompanyBank.findOne({
      companyId,
      bankName: new RegExp(`^${escapeRegex(bn)}$`, "i"),
    }).lean();

    if (bankDoc && brn) {
      branchMatch = (bankDoc.branches || []).find(
        (b) =>
          b.isActive !== false &&
          String(b.name || "").trim().toLowerCase() === brn.toLowerCase()
      );
    }
  }

  const notifyPhone = String(
    overrides.toPhone ||
      overrides.notifyPhone ||
      branchMatch?.notifyPhone ||
      ""
  ).trim();

  const notifyEmail = String(
    overrides.toEmail ||
      overrides.notifyEmail ||
      branchMatch?.notifyEmail ||
      ""
  ).trim();

  return {
    bankName: bn,
    branchName: brn,
    notifyPhone,
    notifyEmail,
    fromBranchConfig: Boolean(branchMatch?.notifyPhone || branchMatch?.notifyEmail),
  };
}

async function resolveBankNotifyRecipients(caseDoc = {}, companyId, overrides = {}) {
  const branchContacts = await resolveBankBranchContacts(
    companyId,
    caseDoc.bankName,
    caseDoc.branchName,
    overrides
  );
  return buildRecipientOptions(caseDoc, branchContacts);
}

module.exports = { resolveBankBranchContacts, resolveBankNotifyRecipients };
