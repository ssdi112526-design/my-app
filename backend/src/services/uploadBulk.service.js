const RepoCase = require("../modules/repoCases/repoCase.model");

const buildCaseCode = (batchId, rowIndex) =>
  `CASE-${String(batchId).slice(-8)}-${rowIndex}-${Math.floor(Math.random() * 1000)}`;

/**
 * bulkWrite with upsert — avoids duplicate loan/vehicle per company.
 * Returns { inserted, modified, failed } counts.
 */
async function bulkUpsertCases(companyId, batchId, payloads, userId) {
  if (!payloads.length) {
    return { inserted: 0, modified: 0, failed: 0 };
  }

  const ops = payloads.map((p, i) => {
    const filter = { companyId };
    const or = [];
    if (p.loanAccountNumber) or.push({ loanAccountNumber: p.loanAccountNumber });
    if (p.vehicleNumber) or.push({ vehicleNumber: p.vehicleNumber });
    if (p.chassisNumber) or.push({ chassisNumber: p.chassisNumber });

    if (or.length) filter.$or = or;

    const update = {
      $set: {
        ...p,
        companyId,
        uploadBatchId: batchId,
        updatedBy: userId,
      },
      $setOnInsert: {
        caseCode: p.caseCode || buildCaseCode(batchId, i),
        createdBy: userId,
      },
    };

    return {
      updateOne: {
        filter,
        update,
        upsert: true,
      },
    };
  });

  try {
    const result = await RepoCase.bulkWrite(ops, { ordered: false });
    return {
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      failed: 0,
    };
  } catch (err) {
    if (err.writeErrors) {
      const failed = err.writeErrors.length;
      const ok = payloads.length - failed;
      return { inserted: ok, modified: 0, failed };
    }
    throw err;
  }
}

module.exports = {
  bulkUpsertCases,
};
