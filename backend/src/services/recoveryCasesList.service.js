const mongoose = require("mongoose");
const RepoCase = require("../modules/repoCases/repoCase.model");
const Confirmation = require("../modules/confirmations/confirmation.model");
const {
  searchS3Cases,
  resolveUploadCaseCount,
  warmCompanySearchCache,
  isCompanySearchReady,
} = require("./uploadS3Search.service");

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTextSearchQuery(trimmedSearch) {
  if (!trimmedSearch) return null;
  const regex = new RegExp(escapeRegex(trimmedSearch), "i");
  return {
    $or: [
      { vehicleNumber: regex },
      { loanAccountNumber: regex },
      { customerName: regex },
      { mobileNumber: regex },
      { bankName: regex },
      { branchName: regex },
      { chassisNumber: regex },
      { caseCode: regex },
    ],
  };
}

async function getPendingConfirmedCaseIds(companyId) {
  const [repoIds, confirmationIds] = await Promise.all([
    RepoCase.distinct("_id", {
      companyId,
      confirmationStatus: { $in: ["PENDING", "CONFIRMED"] },
    }),
    Confirmation.distinct("caseId", {
      companyId,
      status: { $in: ["PENDING", "CONFIRMED"] },
    }),
  ]);

  const merged = new Set([
    ...repoIds.map(String),
    ...confirmationIds.map(String),
  ]);
  return [...merged].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function getRecoveryCounts(companyId) {
  const [pending, confirmed, reviewIds] = await Promise.all([
    RepoCase.countDocuments({ companyId, confirmationStatus: "PENDING" }),
    RepoCase.countDocuments({ companyId, confirmationStatus: "CONFIRMED" }),
    getPendingConfirmedCaseIds(companyId),
  ]);

  return {
    all: reviewIds.length,
    pending,
    confirmed,
    traced: reviewIds.length,
  };
}

async function enrichPageWithTraces(companyId, items) {
  const ids = items
    .map((row) => row._id)
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));

  if (!ids.length) {
    return items.map((row) => ({ ...row, latestTrace: null }));
  }

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const traces = await Confirmation.aggregate([
    { $match: { companyId, caseId: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$caseId",
        requestedByName: { $first: "$requestedByName" },
        requestedByRole: { $first: "$requestedByRole" },
        requestedByPhone: { $first: "$requestedByPhone" },
        shareChannel: { $first: "$shareChannel" },
        status: { $first: "$status" },
        createdAt: { $first: "$createdAt" },
      },
    },
  ]);

  const traceMap = Object.fromEntries(traces.map((t) => [String(t._id), t]));

  return items.map((row) => ({
    ...row,
    latestTrace: traceMap[String(row._id)] || null,
  }));
}

async function mergeS3WithMongo(companyId, s3Items) {
  const lookupValues = new Set();
  s3Items.forEach((row) => {
    if (row.vehicleNumber) {
      lookupValues.add(row.vehicleNumber);
      lookupValues.add(normalizePlate(row.vehicleNumber));
    }
  });
  if (!lookupValues.size) return s3Items;

  const mongoCases = await RepoCase.find({
    companyId,
    vehicleNumber: { $in: [...lookupValues] },
  }).lean();

  const byPlate = {};
  mongoCases.forEach((doc) => {
    byPlate[normalizePlate(doc.vehicleNumber)] = doc;
    if (doc.vehicleNumber) byPlate[doc.vehicleNumber] = doc;
  });

  return s3Items.map((row) => {
    const mongo = byPlate[normalizePlate(row.vehicleNumber)];
    if (!mongo) {
      return {
        ...row,
        confirmationStatus: row.confirmationStatus || "—",
        source: "s3",
      };
    }
    return {
      ...row,
      ...mongo,
      _id: mongo._id,
      source: "mongo",
    };
  });
}

async function listMongoCases(companyId, baseQuery, { search, page, limit }) {
  const clauses = [{ companyId, ...baseQuery }];
  const textQuery = buildTextSearchQuery(search);
  if (textQuery) clauses.push(textQuery);
  const query = clauses.length === 1 ? clauses[0] : { $and: clauses };

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    RepoCase.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    RepoCase.countDocuments(query),
  ]);

  const enriched = await enrichPageWithTraces(companyId, items);

  return {
    items: enriched,
    total,
    page: safePage,
    limit: safeLimit,
    source: "mongo",
  };
}

function toCompanyId(companyId) {
  if (companyId instanceof mongoose.Types.ObjectId) return companyId;
  if (mongoose.Types.ObjectId.isValid(String(companyId))) {
    return new mongoose.Types.ObjectId(String(companyId));
  }
  return companyId;
}

function mapConfirmationToCaseRow(conf, caseDoc = {}) {
  return {
    ...caseDoc,
    _id: caseDoc._id || conf.caseId,
    confirmationStatus: conf.status,
    caseCode: caseDoc.caseCode || "",
    vehicleNumber: caseDoc.vehicleNumber || "",
    customerName: caseDoc.customerName || "",
    bankName: caseDoc.bankName || "",
    branchName: caseDoc.branchName || "",
    loanAccountNumber: caseDoc.loanAccountNumber || "",
    traceStatus: caseDoc.traceStatus || "PENDING",
    repoStatus: caseDoc.repoStatus || "NEW",
    requestedByName: conf.requestedByName || "",
    requestedByRole: conf.requestedByRole || "",
    reportedAt: conf.createdAt,
    requestNote: conf.requestNote || "",
    latestTrace: {
      requestedByName: conf.requestedByName,
      requestedByRole: conf.requestedByRole,
      status: conf.status,
      createdAt: conf.createdAt,
    },
  };
}

function mapRepoCaseToRow(caseDoc) {
  return {
    ...caseDoc,
    confirmationStatus: caseDoc.confirmationStatus,
    reportedAt: caseDoc.updatedAt || caseDoc.createdAt,
    requestedByName: "",
    requestedByRole: "",
    latestTrace: null,
  };
}

function confirmationRowMatchesSearch(row, trimmedSearch) {
  if (!trimmedSearch) return true;
  const regex = new RegExp(escapeRegex(trimmedSearch), "i");
  const haystack = [
    row.caseCode,
    row.vehicleNumber,
    row.customerName,
    row.bankName,
    row.branchName,
    row.loanAccountNumber,
    row.requestedByName,
    row.confirmationStatus,
  ]
    .filter(Boolean)
    .join(" ");
  return regex.test(haystack);
}

async function listPendingAndConfirmedCases(companyId, { search, page, limit }) {
  const cid = toCompanyId(companyId);
  const trimmedSearch = String(search || "").trim();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const skip = (safePage - 1) * safeLimit;

  const [confirmations, repoCases] = await Promise.all([
    Confirmation.find({
      companyId: cid,
      status: { $in: ["PENDING", "CONFIRMED"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    RepoCase.find({
      companyId: cid,
      confirmationStatus: { $in: ["PENDING", "CONFIRMED"] },
    })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const caseIds = [
    ...new Set([
      ...confirmations.map((row) => String(row.caseId)),
      ...repoCases.map((row) => String(row._id)),
    ]),
  ].filter((id) => mongoose.Types.ObjectId.isValid(id));

  const cases =
    caseIds.length > 0
      ? await RepoCase.find({ companyId: cid, _id: { $in: caseIds } }).lean()
      : [];
  const caseMap = Object.fromEntries(cases.map((doc) => [String(doc._id), doc]));

  const items = [];
  const rowKeys = new Set();

  const pushRow = (row) => {
    const key = `${String(row._id || "")}:${String(row.confirmationStatus || "").toUpperCase()}`;
    if (rowKeys.has(key)) return;
    rowKeys.add(key);
    items.push(row);
  };

  confirmations.forEach((conf) => {
    pushRow(mapConfirmationToCaseRow(conf, caseMap[String(conf.caseId)] || {}));
  });

  repoCases.forEach((caseDoc) => {
    const status = String(caseDoc.confirmationStatus || "").toUpperCase();
    const hasMatchingConfirmation = confirmations.some(
      (conf) =>
        String(conf.caseId) === String(caseDoc._id) &&
        String(conf.status || "").toUpperCase() === status
    );
    if (!hasMatchingConfirmation) {
      pushRow(mapRepoCaseToRow(caseDoc));
    }
  });

  items.sort((a, b) => {
    const statusOrder = { PENDING: 0, CONFIRMED: 1 };
    const aStatus = statusOrder[String(a.confirmationStatus || "").toUpperCase()] ?? 2;
    const bStatus = statusOrder[String(b.confirmationStatus || "").toUpperCase()] ?? 2;
    if (aStatus !== bStatus) return aStatus - bStatus;
    const aTime = new Date(a.reportedAt || 0).getTime();
    const bTime = new Date(b.reportedAt || 0).getTime();
    return bTime - aTime;
  });

  let filtered = items;
  if (trimmedSearch) {
    filtered = items.filter((row) => confirmationRowMatchesSearch(row, trimmedSearch));
  }

  const total = filtered.length;
  const paged = filtered.slice(skip, skip + safeLimit);

  return {
    items: paged,
    total,
    page: safePage,
    limit: safeLimit,
    filter: "review",
    source: "confirmations",
  };
}

async function listRecoveryCases(companyId, { filter = "all", search = "", page = 1, limit = 100 }) {
  const normalizedFilter = String(filter || "all").toLowerCase();

  if (normalizedFilter === "review") {
    return listPendingAndConfirmedCases(companyId, { search, page, limit });
  }

  if (normalizedFilter === "pending") {
    const result = await listMongoCases(
      companyId,
      { confirmationStatus: "PENDING" },
      { search, page, limit }
    );
    return { ...result, filter: "pending" };
  }

  if (normalizedFilter === "confirmed") {
    const result = await listMongoCases(
      companyId,
      { confirmationStatus: "CONFIRMED" },
      { search, page, limit }
    );
    return { ...result, filter: "confirmed" };
  }

  if (normalizedFilter === "traced") {
    const tracedIds = await Confirmation.distinct("caseId", { companyId });
    if (!tracedIds.length) {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
      return {
        items: [],
        total: 0,
        page: safePage,
        limit: safeLimit,
        filter: "traced",
        source: "mongo",
      };
    }
    const result = await listMongoCases(
      companyId,
      { _id: { $in: tracedIds } },
      { search, page, limit }
    );
    return { ...result, filter: "traced" };
  }

  const uploadRows = await resolveUploadCaseCount(companyId);
  if (uploadRows > 0) {
    if (!isCompanySearchReady(companyId)) {
      await warmCompanySearchCache(companyId);
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);

    const s3Result = await searchS3Cases(companyId, {
      search: String(search || "").trim(),
      type: "general",
      page: safePage,
      limit: safeLimit,
    });

    let items = await mergeS3WithMongo(companyId, s3Result.items);
    items = await enrichPageWithTraces(companyId, items);

    return {
      items,
      total: s3Result.total,
      page: safePage,
      limit: safeLimit,
      filter: "all",
      source: "s3",
    };
  }

  const result = await listMongoCases(companyId, {}, { search, page, limit });
  return { ...result, filter: "all" };
}

module.exports = {
  getRecoveryCounts,
  listRecoveryCases,
};
