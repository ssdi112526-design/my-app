const mongoose = require("mongoose");
const RepoCase = require("./repoCase.model");
const UploadBatch = require("../uploads/uploadBatch.model");
const VehicleLoadedNote = require("./vehicleLoadedNote.model");
const {
  searchS3Cases,
  resolveUploadCaseCount,
  warmCompanySearchCache,
  isCompanySearchReady,
  resolveFullUploadRowWithTimeout,
} = require("../../services/uploadS3Search.service");
const {
  searchUploadRows,
  companyNeedsS3SearchFallback,
  getTypedPrefixRestriction,
} = require("../../services/uploadSearchRows.service");
const { SEARCH_MAX_LIMIT } = require("../uploads/upload.constants");

const ALLOWED_SEARCH_TYPES = new Set([
  "general",
  "vehicleNumber",
  "chassisNumber",
  "loanAccountNumber",
  "mobileNumber",
  "phone",
]);

function parseSearchPaging(query = {}) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const requested = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 50;
  const limit = Math.max(1, Math.min(requested, SEARCH_MAX_LIMIT));
  let type = String(query.type || "general");
  if (!ALLOWED_SEARCH_TYPES.has(type)) type = "general";
  return { page, limit, type };
}

function withSearchPaging(payload, page, limit, total) {
  const t = Number(total) || 0;
  const hasNext = t > page * limit;
  const hasPrevious = page > 1;
  return {
    ...payload,
    page,
    limit,
    pageSize: limit,
    total: t,
    hasNext,
    hasPrevious,
    pagination: {
      page,
      pageSize: limit,
      total: t,
      hasNext,
      hasPrevious,
    },
  };
}
const { mergeCaseForBankNotify } = require("../../utils/mergeCaseForBankNotify");
const {
  applyExcelContactsToCase,
  extractExcelNotifyContacts,
  hasBankerNotifyContacts,
} = require("../../utils/excelNotifyContacts");
const CompanyBank = require("../companyBanks/companyBank.model");
const Company = require("../companies/company.model");
const Confirmation = require("../confirmations/confirmation.model");
const User = require("../users/user.model");
const { formatRepoRole } = require("../../utils/repoRoleLabels");
const {
  escapeRegex,
  normalizeSmsTo,
  sendBankTracedEmail,
  sendSmsTwilio,
} = require("../../utils/bankNotifyDispatch");
const {
  buildBankTracedNotifyText,
  buildBankTracedSubject,
} = require("../../utils/bankNotifyMessage");
const {
  getRecoveryCounts,
  listRecoveryCases,
} = require("../../services/recoveryCasesList.service");
const {
  resolveBankBranchContacts,
  resolveBankNotifyRecipients,
} = require("../../services/bankNotifyContacts.service");
const { getAdminBankerReferenceRows } = require("../../utils/excelNotifyContacts");
const { getExcelColumnOrder } = require("../../utils/excelSheetDisplay");

const buildCaseCode = () => {
  return `CASE-${Date.now()}`;
};

const createRepoCase = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const {
      bankName,
      branchName,
      customerName,
      mobileNumber,
      loanAccountNumber,
      vehicleNumber,
      addressLine1,
      city,
      state,
      remarks,
    } = req.body;

    if (!bankName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    if (!branchName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Branch name is required.",
      });
    }

    if (!customerName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }

    if (!mobileNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required.",
      });
    }

    if (!loanAccountNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Loan account number is required.",
      });
    }

    if (!vehicleNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number is required.",
      });
    }

    if (!addressLine1?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Address is required.",
      });
    }

    if (!city?.trim()) {
      return res.status(400).json({
        success: false,
        message: "City is required.",
      });
    }

    if (!state?.trim()) {
      return res.status(400).json({
        success: false,
        message: "State is required.",
      });
    }

    const duplicate = await RepoCase.findOne({
      companyId,
      $or: [
        { loanAccountNumber: loanAccountNumber.trim() },
        { vehicleNumber: vehicleNumber.trim().toUpperCase() },
      ],
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "A case with the same loan number or vehicle number already exists.",
      });
    }

    const data = {
      companyId,
      caseCode: req.body.caseCode || buildCaseCode(),
      bankName: bankName.trim(),
      branchName: branchName.trim(),
      customerName: customerName.trim(),
      mobileNumber: mobileNumber.trim(),
      loanAccountNumber: loanAccountNumber.trim(),
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    };

    if (remarks?.trim()) {
      data.remarks = [
        {
          text: remarks.trim(),
          addedBy: req.user.userId,
          addedByName: req.user.name,
          createdAt: new Date(),
        },
      ];
    }

    const doc = await RepoCase.create(data);

    return res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

function normalizePlate(value) {
  return String(value || "")
    .replace(/[\s\-_.]/g, "")
    .toUpperCase();
}

/**
 * Search by vehicle number and return latest "who traced it"
 * (latest confirmation) for each matching case in this company.
 */
const getTracedByVehicleNumber = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const vehicleNumber = normalizePlate(req.query.vehicleNumber);

    if (!vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: "vehicleNumber is required.",
      });
    }

    const caseDocs = await RepoCase.find({
      companyId,
      vehicleNumber,
    })
      .select(
        "_id caseCode vehicleNumber customerName bankName branchName repoStatus confirmationStatus"
      )
      .lean();

    if (!caseDocs.length) {
      return res.json({ success: true, items: [] });
    }

    const caseIds = caseDocs.map((c) => c._id);

    // Latest confirmation per case (represents the latest tracer who reported it).
    const latestConfirmations = await Confirmation.aggregate([
      { $match: { companyId, caseId: { $in: caseIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$caseId",
          latest: { $first: "$$ROOT" },
        },
      },
    ]);

    const latestByCaseId = Object.fromEntries(
      latestConfirmations.map((x) => [String(x._id), x.latest])
    );

    const items = caseDocs.map((c) => {
      const latest = latestByCaseId[String(c._id)];
      return {
        caseId: c._id,
        caseCode: c.caseCode || "",
        vehicleNumber: c.vehicleNumber || "",
        customerName: c.customerName || "",
        bankName: c.bankName || "",
        branchName: c.branchName || "",
        repoStatus: c.repoStatus || "",
        confirmationStatus: c.confirmationStatus || "",
        latestTrace: latest
          ? {
              requestedByName: latest.requestedByName || "",
              requestedByRole: latest.requestedByRole || "",
              requestedByRoleLabel: formatRepoRole(
                latest.requestedByRole
              ),
              requestedByPhone: latest.requestedByPhone || "",
              traceMode: latest.traceMode || "ONLINE",
              shareChannel: latest.shareChannel || null,
              status: latest.status || "",
              reportedAt: latest.createdAt || null,
            }
          : null,
      };
    });

    return res.json({ success: true, items });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRepoCases = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      search = "",
      hasVehicleNumber = "",
      recoveryFilter = "",
    } = req.query;
    const { page, limit, type } = parseSearchPaging(req.query);

    const trimmedSearch = String(search || "").trim();
    const recoveryFilterNorm = String(recoveryFilter || "").toLowerCase();

    if (
      recoveryFilterNorm &&
      ["all", "review", "pending", "confirmed", "traced"].includes(recoveryFilterNorm)
    ) {
      const [result, counts] = await Promise.all([
        listRecoveryCases(companyId, {
          filter: recoveryFilterNorm,
          search: trimmedSearch,
          page,
          limit,
        }),
        getRecoveryCounts(companyId),
      ]);

      return res.json(
        withSearchPaging(
          {
            success: true,
            items: result.items,
            source: result.source,
            filter: result.filter,
            counts,
          },
          result.page,
          result.limit,
          result.total
        )
      );
    }

    const query = { companyId };

    if (hasVehicleNumber === "true" && !trimmedSearch) {
      query.vehicleNumber = { $exists: true, $nin: [null, ""] };
    }

    if (trimmedSearch) {
      const escapeRegex = (str) =>
        String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapeRegex(trimmedSearch), "i");

      if (type === "vehicleNumber") {
        query.vehicleNumber = regex;
      } else if (type === "chassisNumber") {
        query.chassisNumber = regex;
      } else if (type === "loanAccountNumber") {
        query.loanAccountNumber = regex;
      } else if (type === "mobileNumber" || type === "phone") {
        const digits = trimmedSearch.replace(/\D/g, "");
        const phonePattern = digits.length >= 6 ? digits : trimmedSearch;
        const phoneRegex = new RegExp(escapeRegex(phonePattern), "i");
        query.$or = [
          { mobileNumber: phoneRegex },
          { alternateMobileNumber: phoneRegex },
          { contactPerson1Phone: phoneRegex },
          { contactPerson2Phone: phoneRegex },
          { contactPerson3Phone: phoneRegex },
        ];
      } else {
        const digits = trimmedSearch.replace(/\D/g, "");
        const phonePattern = digits.length >= 6 ? digits : trimmedSearch;
        const phoneRegex = new RegExp(escapeRegex(phonePattern), "i");
        query.$or = [
          { vehicleNumber: regex },
          { loanAccountNumber: regex },
          { customerName: regex },
          { mobileNumber: regex },
          { alternateMobileNumber: regex },
          { contactPerson1Phone: phoneRegex },
          { contactPerson2Phone: phoneRegex },
          { contactPerson3Phone: phoneRegex },
          { bankName: regex },
          { branchName: regex },
          { chassisNumber: regex },
          { engineNumber: regex },
          { caseCode: regex },
        ];
      }
    }

    const safePage = page;
    const safeLimit = limit;
    const skip = (safePage - 1) * safeLimit;

    const searchStartedAt = Date.now();
    const items = await RepoCase.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();

    const total = await RepoCase.countDocuments(query);
    const repoMs = Date.now() - searchStartedAt;

    if (total > 0) {
      console.log(
        `[search] hit=repo_cases repo_cases=${repoMs}ms upload_search_rows=0ms s3=0ms total=${repoMs}ms results=${total}`
      );
      return res.json(withSearchPaging({ success: true, items }, safePage, safeLimit, total));
    }

    const prefixRestriction = getTypedPrefixRestriction(trimmedSearch, type);
    if (prefixRestriction) {
      console.log(
        `[search] hit=restricted repo_cases=${repoMs}ms upload_search_rows=skipped s3=skipped total=${Date.now() - searchStartedAt}ms results=0`
      );
      return res.json(
        withSearchPaging(
          {
            success: true,
            items: [],
            searchRestricted: true,
            minSearchLength: prefixRestriction.minSearchLength,
          },
          safePage,
          safeLimit,
          0
        )
      );
    }

    const uploadRows = await resolveUploadCaseCount(companyId);
    const hasCompletedUploads =
      uploadRows > 0 ||
      Boolean(
        await UploadBatch.exists({
          companyId,
          status: "completed",
        })
      );

    if (hasCompletedUploads) {
      const pgStartedAt = Date.now();
      let pgResult = { items: [], total: 0, page: safePage, limit: safeLimit };
      let pgMs = 0;
      let pgFailed = false;
      try {
        pgResult = await searchUploadRows({
          companyId,
          search: trimmedSearch,
          type,
          page: safePage,
          limit: safeLimit,
          hasVehicleNumber: hasVehicleNumber === "true",
        });
        pgMs = Date.now() - pgStartedAt;
      } catch (pgErr) {
        pgFailed = true;
        pgMs = Date.now() - pgStartedAt;
        console.error("upload_search_rows search failed:", pgErr.message);
      }

      if (pgResult.searchRestricted) {
        console.log(
          `[search] hit=restricted repo_cases=${repoMs}ms upload_search_rows=${pgMs}ms s3=skipped total=${Date.now() - searchStartedAt}ms results=0`
        );
        return res.json(
          withSearchPaging(
            {
              success: true,
              items: [],
              searchRestricted: true,
              minSearchLength: pgResult.minSearchLength,
            },
            safePage,
            safeLimit,
            0
          )
        );
      }

      if (pgResult.searchTimeout) {
        console.log(
          `[search] hit=timeout repo_cases=${repoMs}ms upload_search_rows=${pgMs}ms s3=skipped total=${Date.now() - searchStartedAt}ms results=0`
        );
        return res.json(
          withSearchPaging(
            { success: true, items: [], searchTimeout: true },
            safePage,
            safeLimit,
            0
          )
        );
      }

      if (pgResult.total > 0) {
        console.log(
          `[search] hit=upload_search_rows repo_cases=${repoMs}ms upload_search_rows=${pgMs}ms s3=0ms total=${Date.now() - searchStartedAt}ms results=${pgResult.total}`
        );
        return res.json(
          withSearchPaging(
            { success: true, items: pgResult.items },
            pgResult.page,
            pgResult.limit,
            pgResult.total
          )
        );
      }

      let needsLegacyS3 = true;
      try {
        needsLegacyS3 = pgFailed || (await companyNeedsS3SearchFallback(companyId));
      } catch (fallbackErr) {
        console.error("S3 fallback check failed:", fallbackErr.message);
      }

      if (!needsLegacyS3) {
        console.log(
          `[search] hit=none repo_cases=${repoMs}ms upload_search_rows=${pgMs}ms s3=skipped total=${Date.now() - searchStartedAt}ms results=0`
        );
        return res.json(withSearchPaging({ success: true, items: [] }, safePage, safeLimit, 0));
      }

      try {
        if (!isCompanySearchReady(companyId)) {
          // Do not block the HTTP request on a full S3 warm (Render/live).
          warmCompanySearchCache(companyId).catch((err) => {
            console.error("Background search warm failed:", err.message);
          });
        }

        const s3StartedAt = Date.now();
        const s3Result = await searchS3Cases(companyId, {
          search: trimmedSearch,
          type,
          page: safePage,
          limit: safeLimit,
          hasVehicleNumber: hasVehicleNumber === "true",
        });
        const s3Ms = Date.now() - s3StartedAt;
        console.log(
          `[search] hit=s3 repo_cases=${repoMs}ms upload_search_rows=${pgMs}ms s3=${s3Ms}ms total=${Date.now() - searchStartedAt}ms results=${s3Result.total}`
        );

        return res.json(
          withSearchPaging(
            {
              success: true,
              items: s3Result.items,
              source: "s3",
              searchReady: s3Result.searchReady !== false,
            },
            s3Result.page,
            s3Result.limit,
            s3Result.total
          )
        );
      } catch (s3Err) {
        console.error("S3 vehicle search failed:", s3Err.message);
      }
    } else {
      console.log(
        `[search] hit=none repo_cases=${repoMs}ms upload_search_rows=skipped s3=skipped total=${repoMs}ms results=0`
      );
    }

    return res.json(withSearchPaging({ success: true, items }, safePage, safeLimit, total));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRepoCaseById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const doc = await RepoCase.findOne({
      _id: req.params.id,
      companyId,
    }).populate("assignedToUserId", "name email role");

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Case not found.",
      });
    }

    const latestTrace = await Confirmation.findOne({
      companyId,
      caseId: doc._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    let payload = applyExcelContactsToCase(doc.toObject());
    if (!hasBankerNotifyContacts(extractExcelNotifyContacts(payload))) {
      const uploadRow = await resolveFullUploadRowWithTimeout(companyId, payload, 8000);
      if (uploadRow) {
        payload = applyExcelContactsToCase(mergeCaseForBankNotify(payload, uploadRow));
      }
    }

    if (latestTrace) {
      payload.latestTraceReport = {
        confirmationId: latestTrace._id,
        requestNote: latestTrace.requestNote,
        requestedByName: latestTrace.requestedByName,
        requestedByRole: latestTrace.requestedByRole,
        requestedByPhone: latestTrace.requestedByPhone,
        traceMode: latestTrace.traceMode || "ONLINE",
        shareChannel: latestTrace.shareChannel || null,
        reportedAt: latestTrace.createdAt,
        status: latestTrace.status,
      };
    }

    const efOrder = payload.excelFields?._excelColumnOrder;
    let excelColumnOrder =
      Array.isArray(efOrder) && efOrder.length
        ? efOrder.map(String).filter(Boolean)
        : getExcelColumnOrder(payload.excelFields || {});
    if (!excelColumnOrder.length && payload.uploadBatchId) {
      const batch = await UploadBatch.findOne({
        _id: payload.uploadBatchId,
        companyId,
      })
        .select("columnNames")
        .lean();
      excelColumnOrder = batch?.columnNames || [];
    }
    if (excelColumnOrder.length) {
      payload.excelColumnOrder = excelColumnOrder;
      const ef = payload.excelFields || {};
      if (!Array.isArray(ef._excelColumnOrder) || !ef._excelColumnOrder.length) {
        payload.excelFields = { ...ef, _excelColumnOrder: excelColumnOrder };
      }
    }

    return res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addRemarkToRepoCase = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Remark text is required.",
      });
    }

    const doc = await RepoCase.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Case not found.",
      });
    }

    doc.remarks.push({
      text,
      addedBy: req.user.userId,
      addedByName: req.user.name,
      createdAt: new Date(),
    });

    doc.updatedBy = req.user.userId;
    doc.lastActionAt = new Date();

    await doc.save();

    return res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

async function resolveCaseDocForBankNotify(companyId, caseId, searchItem = {}) {
  let mongoCase = null;
  if (caseId && mongoose.Types.ObjectId.isValid(String(caseId))) {
    mongoCase = await RepoCase.findOne({ _id: caseId, companyId }).lean();
  }

  let merged = applyExcelContactsToCase(mergeCaseForBankNotify(mongoCase || {}, searchItem));
  if (!hasBankerNotifyContacts(extractExcelNotifyContacts(merged))) {
    const uploadRow = await resolveFullUploadRowWithTimeout(companyId, merged, 8000);
    if (uploadRow) {
      merged = mergeCaseForBankNotify(merged, uploadRow);
    }
  }

  const hasIdentity =
    merged.vehicleNumber ||
    merged.chassisNumber ||
    merged.loanAccountNumber ||
    merged.customerName;

  return hasIdentity ? applyExcelContactsToCase(merged) : null;
}

const getBankNotifyMessage = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const caseId = req.body.caseId;
    const searchItem = req.body.searchItem || {};

    const caseDoc = await resolveCaseDocForBankNotify(companyId, caseId, searchItem);

    if (!caseDoc) {
      return res.status(400).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    const adminUser = await User.findById(req.user.userId).select("name phone").lean();
    const company = await Company.findById(companyId).select("companyName").lean();

    const notifyContext = {
      agency: company?.companyName ? { name: company.companyName } : null,
      admin: {
        name: String(req.body.adminName || adminUser?.name || req.user.name || "").trim(),
        phone: String(req.body.adminPhone || adminUser?.phone || req.user.phone || "").trim(),
      },
      includeAdminBankerRef: true,
    };

    const recipients = await resolveBankNotifyRecipients(caseDoc, companyId, {
      notifyPhone: req.body.toPhone || req.body.notifyPhone,
      notifyEmail: req.body.toEmail || req.body.notifyEmail,
    });

    let excelColumnOrder = getExcelColumnOrder(caseDoc.excelFields || {});
    if (!excelColumnOrder.length && caseDoc.uploadBatchId) {
      const batch = await UploadBatch.findOne({
        _id: caseDoc.uploadBatchId,
        companyId,
      })
        .select("columnNames")
        .lean();
      excelColumnOrder = batch?.columnNames || [];
    }

    const enrichedCase = { ...caseDoc };
    if (excelColumnOrder.length) {
      enrichedCase.excelColumnOrder = excelColumnOrder;
      const ef = enrichedCase.excelFields || {};
      if (!Array.isArray(ef._excelColumnOrder) || !ef._excelColumnOrder.length) {
        enrichedCase.excelFields = {
          ...ef,
          _excelColumnOrder: excelColumnOrder,
        };
      }
    }

    const message = buildBankTracedNotifyText(enrichedCase, notifyContext);
    const subject = buildBankTracedSubject(enrichedCase);

    return res.json({
      success: true,
      data: {
        message,
        subject,
        bankNotifyPhone: recipients.suggestedPhone,
        bankNotifyEmail: recipients.suggestedEmail,
        defaultRecipientId: recipients.defaultRecipientId,
        recipientOptions: recipients.options,
        excelContacts: recipients.excel,
        bankerRows: getAdminBankerReferenceRows(caseDoc),
        enrichedCase,
        excelColumnOrder,
        bankName: caseDoc.bankName || "",
        branchName: caseDoc.branchName || "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const notifyBankTraced = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const caseDoc = await resolveCaseDocForBankNotify(
      companyId,
      req.params.id,
      req.body.searchItem || {}
    );

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: "Case not found.",
      });
    }

    const registrationNumber = (caseDoc.vehicleNumber || "").trim() || "—";
    const channel = String(req.body.channel || "both").toLowerCase();

    const bankContacts = await resolveBankBranchContacts(
      companyId,
      caseDoc.bankName,
      caseDoc.branchName,
      req.body
    );
    const toEmail = bankContacts.notifyEmail;
    const toPhone = bankContacts.notifyPhone;

    const adminUser = await User.findById(req.user.userId).select("name phone").lean();
    const company = await Company.findById(companyId).select("companyName").lean();
    const orgName = company?.companyName || "Repo team";

    const adminName =
      String(req.body.adminName || "").trim() ||
      adminUser?.name ||
      req.user.name ||
      "";
    const adminPhone =
      String(req.body.adminPhone || "").trim() ||
      adminUser?.phone ||
      req.user.phone ||
      "";

    const notifyContext = {
      agency: company?.companyName ? { name: company.companyName } : null,
      admin: {
        name: adminName,
        phone: adminPhone,
      },
      includeAdminBankerRef: true,
    };

    const text = buildBankTracedNotifyText(caseDoc, notifyContext);
    const subject = buildBankTracedSubject(caseDoc);
    const smsBody = text.length > 1500 ? text.slice(0, 1497) + "..." : text;

    if (channel === "whatsapp") {
      return res.json({
        success: true,
        data: {
          message: text,
          subject,
          usedRecipients: {
            email: toEmail || null,
            phone: toPhone || null,
          },
        },
      });
    }

    const sendEmail = channel === "email" || channel === "both";
    const sendSms = channel === "sms" || channel === "both";

    if (sendEmail && !toEmail && sendSms && !toPhone) {
      return res.status(400).json({
        success: false,
        message:
          "No bank notification email or phone. Add bank email/phone in the notify dialog, or configure branch contacts.",
      });
    }

    if (sendEmail && !toEmail && !sendSms) {
      return res.status(400).json({
        success: false,
        message: "Bank email is required to send email notification.",
      });
    }

    if (sendSms && !toPhone && !sendEmail) {
      return res.status(400).json({
        success: false,
        message: "Bank phone is required to send SMS notification.",
      });
    }

    const textWithFooter = `${text}\n\n— ${orgName}`;

    const results = {
      email: sendEmail
        ? toEmail
          ? await sendBankTracedEmail({ to: toEmail, subject, text: textWithFooter })
          : { skipped: true, reason: "No email recipient" }
        : { skipped: true, reason: "Email not requested" },
      sms: sendSms
        ? toPhone
          ? await sendSmsTwilio({ to: toPhone, body: smsBody })
          : { skipped: true, reason: "No SMS recipient" }
        : { skipped: true, reason: "SMS not requested" },
    };

    const emailOk = results.email?.ok === true;
    const smsOk = results.sms?.ok === true;
    const attemptedEmail = sendEmail && Boolean(toEmail);
    const attemptedSms = sendSms && Boolean(toPhone);

    if ((attemptedEmail || attemptedSms) && !emailOk && !smsOk) {
      return res.status(502).json({
        success: false,
        message:
          "Could not send email or SMS. Configure SMTP (SMTP_HOST, etc.) and/or Twilio (TWILIO_*), and verify recipients.",
        data: { results },
      });
    }
    return res.json({
      success: true,
      data: {
        results,
        usedRecipients: {
          email: toEmail || null,
          phone: toPhone || null,
        },
        matchedBankBranch: Boolean(bankDoc && branchMatch),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfTomorrow() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}
/** Total uploaded Excel rows (S3 index); falls back to Mongo case count if no uploads. */
async function resolveCompanyCaseCount(companyId) {
  const uploadRows = await resolveUploadCaseCount(companyId);
  if (uploadRows > 0) return uploadRows;
  return RepoCase.countDocuments({ companyId });
}
async function resolveTodayActivity(companyId) {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();

  const caseActivity = await RepoCase.countDocuments({
    companyId,
    updatedAt: { $gte: today, $lt: tomorrow },
  });

  const uploadToday = await UploadBatch.aggregate([
    {
      $match: {
        companyId,
        status: "completed",
        importMode: "s3_only",
        updatedAt: { $gte: today, $lt: tomorrow },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ["$successRows", 0] }, 0] },
              "$successRows",
              { $ifNull: ["$totalRows", 0] },
            ],
          },
        },
      },
    },
  ]);

  return caseActivity + (uploadToday[0]?.total || 0);
}

const getStatsOverview = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const [cases, todayActivity] = await Promise.all([
      resolveCompanyCaseCount(companyId),
      resolveTodayActivity(companyId),
    ]);

    return res.json({
      success: true,
      data: { cases, todayActivity },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTodayActivity = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const todayActivity = await resolveTodayActivity(companyId);

    return res.json({
      success: true,
      data: { todayActivity },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const warmSearchCache = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (isCompanySearchReady(companyId)) {
      return res.json({
        success: true,
        data: { ready: true, message: "Search index is ready in memory." },
      });
    }

    setImmediate(() => {
      warmCompanySearchCache(companyId).catch((err) => {
        console.error("Background search warm failed:", err.message);
      });
    });

    return res.json({
      success: true,
      data: {
        ready: false,
        warming: true,
        message: "Loading search index into memory (one time).",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

function normalizeLoadedLookup(vehicleNumber, chassisNumber) {
  const v = String(vehicleNumber || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const c = String(chassisNumber || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return { vehicleNumber: v, chassisNumber: c, lookupKey: v || c };
}

const getVehicleLoaded = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const caseId = String(req.query.caseId || "").trim();
    const { vehicleNumber, chassisNumber, lookupKey } = normalizeLoadedLookup(
      req.query.vehicleNumber,
      req.query.chassisNumber
    );

    if (!lookupKey && !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number or chassis number is required.",
      });
    }

    let loadedShort = "";
    let loadedDetail = "";
    let uploadBankName = "";
    let uploadBranchName = "";

    const uploadBatchId = String(req.query.uploadBatchId || "").trim();
    if (mongoose.Types.ObjectId.isValid(uploadBatchId)) {
      const batch = await UploadBatch.findOne({ _id: uploadBatchId, companyId })
        .select("bankName branchName")
        .lean();
      if (batch) {
        uploadBankName = String(batch.bankName || "").trim();
        uploadBranchName = String(batch.branchName || "").trim();
      }
    }

    if (lookupKey) {
      const note = await VehicleLoadedNote.findOne({ companyId, lookupKey })
        .select("loadedShort loadedDetail updatedAt updatedByName")
        .lean();
      if (note) {
        loadedShort = note.loadedShort || "";
        loadedDetail = note.loadedDetail || "";
      }
    }

    if (mongoose.Types.ObjectId.isValid(caseId)) {
      const doc = await RepoCase.findOne({ _id: caseId, companyId })
        .select("loadedShort loadedDetail bankName branchName uploadBatchId")
        .lean();
      if (doc) {
        if (doc.loadedShort) loadedShort = doc.loadedShort;
        if (doc.loadedDetail) loadedDetail = doc.loadedDetail;
        if (!uploadBankName && doc.bankName) uploadBankName = String(doc.bankName).trim();
        if (!uploadBranchName && doc.branchName) {
          uploadBranchName = String(doc.branchName).trim();
        }
        if (!uploadBankName && doc.uploadBatchId) {
          const batch = await UploadBatch.findOne({ _id: doc.uploadBatchId, companyId })
            .select("bankName branchName")
            .lean();
          if (batch) {
            uploadBankName = String(batch.bankName || "").trim();
            uploadBranchName = String(batch.branchName || "").trim();
          }
        }
      }
    }

    return res.json({
      success: true,
      data: {
        loadedShort,
        loadedDetail,
        lookupKey,
        uploadBankName,
        uploadBranchName,
        bankName: uploadBankName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const saveVehicleLoaded = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const caseId = String(req.body.caseId || "").trim();
    const loadedShort = String(req.body.loadedShort || "").trim().slice(0, 120);
    const loadedDetail = String(req.body.loadedDetail || "").trim().slice(0, 2000);
    const { vehicleNumber, chassisNumber, lookupKey } = normalizeLoadedLookup(
      req.body.vehicleNumber,
      req.body.chassisNumber
    );

    if (!lookupKey && !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number or chassis number is required.",
      });
    }

    if (lookupKey) {
      await VehicleLoadedNote.findOneAndUpdate(
        { companyId, lookupKey },
        {
          companyId,
          lookupKey,
          vehicleNumber,
          chassisNumber,
          loadedShort,
          loadedDetail,
          updatedBy: req.user.userId,
          updatedByName: req.user.name || "",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    if (mongoose.Types.ObjectId.isValid(caseId)) {
      await RepoCase.updateOne(
        { _id: caseId, companyId },
        {
          $set: {
            loadedShort,
            loadedDetail,
            updatedBy: req.user.userId,
            lastActionAt: new Date(),
          },
        }
      );
    }

    return res.json({
      success: true,
      data: { loadedShort, loadedDetail, lookupKey },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSearchCacheStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    return res.json({
      success: true,
      data: { ready: isCompanySearchReady(companyId) },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createRepoCase,
  getRepoCases,
  getRepoCaseById,
  getTracedByVehicleNumber,
  getVehicleLoaded,
  saveVehicleLoaded,
  addRemarkToRepoCase,
  getBankNotifyMessage,
  notifyBankTraced,
  getStatsOverview,
  getTodayActivity,
  warmSearchCache,
  getSearchCacheStatus,
};