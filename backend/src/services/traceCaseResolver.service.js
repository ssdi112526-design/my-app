const mongoose = require("mongoose");
const RepoCase = require("../modules/repoCases/repoCase.model");
const VehicleLoadedNote = require("../modules/repoCases/vehicleLoadedNote.model");

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

function buildCaseCode(batchId, rowIndex) {
  const suffix = batchId ? String(batchId).slice(-8) : "SEARCH";
  return `CASE-${suffix}-${rowIndex}-${Math.floor(Math.random() * 1000)}`;
}

function pickSearchFields(item = {}) {
  const vehicleNumber = normalizePlate(item.vehicleNumber);
  const uploadBatchId =
    item.uploadBatchId && mongoose.Types.ObjectId.isValid(String(item.uploadBatchId))
      ? item.uploadBatchId
      : null;

  return {
    uploadBatchId,
    bankName: item.bankName || "",
    branchName: item.branchName || "",
    customerName: String(item.customerName || "").trim() || "Unknown",
    mobileNumber: item.mobileNumber || "",
    alternateMobileNumber: item.alternateMobileNumber || "",
    loanAccountNumber: item.loanAccountNumber || "",
    referenceNumber: item.referenceNumber || "",
    vehicleNumber,
    chassisNumber: item.chassisNumber
      ? String(item.chassisNumber).toUpperCase()
      : "",
    engineNumber: item.engineNumber || "",
    vehicleBrand: item.vehicleBrand || "",
    vehicleModel: item.vehicleModel || "",
    vehicleType: item.vehicleType || "",
    addressLine1: item.addressLine1 || "",
    addressLine2: item.addressLine2 || "",
    city: item.city || "",
    district: item.district || "",
    state: item.state || "",
    pincode: item.pincode || "",
    emiAmount: Number(item.emiAmount) || 0,
    dueAmount: Number(item.dueAmount) || 0,
    totalOutstandingAmount: Number(item.totalOutstandingAmount) || 0,
    bucket: item.bucket || "",
    fieldNotes: item.fieldNotes || "",
    loadedShort: String(item.loadedShort || "").trim().slice(0, 120),
    loadedDetail: String(item.loadedDetail || item.loadedShort || "")
      .trim()
      .slice(0, 2000),
  };
}

async function enrichLoadedOnCase(companyId, caseDoc, searchItem = {}) {
  if (!caseDoc) return caseDoc;

  let loadedDetail = String(
    searchItem.loadedDetail || searchItem.loadedShort || caseDoc.loadedDetail || caseDoc.loadedShort || ""
  ).trim();

  if (!loadedDetail) {
    const lookupKey =
      normalizePlate(caseDoc.vehicleNumber) ||
      String(caseDoc.chassisNumber || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
    if (lookupKey) {
      const note = await VehicleLoadedNote.findOne({ companyId, lookupKey })
        .select("loadedDetail loadedShort")
        .lean();
      loadedDetail = String(note?.loadedDetail || note?.loadedShort || "").trim();
    }
  }

  if (!loadedDetail) return caseDoc;

  return { ...caseDoc, loadedDetail, loadedShort: "" };
}

/**
 * Resolve a Mongo repo case for tracing: existing case id, DB match, or upsert from S3/search row.
 */
async function resolveRepoCaseForTrace(companyId, { caseId, searchItem }, userId) {
  const cid = companyId;

  if (caseId && mongoose.Types.ObjectId.isValid(String(caseId))) {
    const existing = await RepoCase.findOne({ _id: caseId, companyId: cid }).lean();
    if (existing) {
      const enriched = await enrichLoadedOnCase(cid, existing, searchItem || {});
      const loadedDetail = enriched.loadedDetail || "";
      if (loadedDetail && loadedDetail !== (existing.loadedDetail || existing.loadedShort || "")) {
        await RepoCase.updateOne(
          { _id: existing._id, companyId: cid },
          { $set: { loadedDetail, loadedShort: "", updatedBy: userId } }
        );
      }
      return enriched;
    }
  }

  const fields = pickSearchFields(searchItem || {});
  if (!fields.vehicleNumber && !fields.loanAccountNumber && !fields.chassisNumber) {
    return null;
  }

  const or = [];
  if (fields.vehicleNumber) or.push({ vehicleNumber: fields.vehicleNumber });
  if (fields.loanAccountNumber) or.push({ loanAccountNumber: fields.loanAccountNumber });
  if (fields.chassisNumber) or.push({ chassisNumber: fields.chassisNumber });

  const found = await RepoCase.findOne({ companyId: cid, $or: or }).lean();
  if (found) {
    const enriched = await enrichLoadedOnCase(cid, found, searchItem || {});
    const loadedDetail = enriched.loadedDetail || "";
    if (loadedDetail && loadedDetail !== (found.loadedDetail || found.loadedShort || "")) {
      await RepoCase.updateOne(
        { _id: found._id, companyId: cid },
        { $set: { loadedDetail, loadedShort: "", updatedBy: userId } }
      );
    }
    return enriched;
  }

  const batchId = fields.uploadBatchId || new mongoose.Types.ObjectId();
  const rowIndex = Date.now() % 100000;

  const created = await RepoCase.create({
    companyId: cid,
    caseCode: buildCaseCode(batchId, rowIndex),
    ...fields,
    repoStatus: "NEW",
    confirmationStatus: "PENDING",
    createdBy: userId,
    updatedBy: userId,
  });

  const createdObj = created.toObject();
  return enrichLoadedOnCase(cid, createdObj, searchItem || {});
}

module.exports = {
  resolveRepoCaseForTrace,
  normalizePlate,
};
