const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Confirmation = require("./confirmation.model");
const RepoCase = require("../repoCases/repoCase.model");
const User = require("../users/user.model");
const Notification = require("../notifications/notification.model");
const {
  buildTraceReportToAdminText,
  buildWhatsAppUrl,
} = require("../../utils/bankNotifyMessage");
const { formatRepoRole } = require("../../utils/repoRoleLabels");
const { resolveRepoCaseForTrace } = require("../../services/traceCaseResolver.service");
const { resolveFullUploadRowWithTimeout } = require("../../services/uploadS3Search.service");
const {
  extractExcelNotifyContacts,
  hasBankerNotifyContacts,
} = require("../../utils/excelNotifyContacts");
const { mergeCaseForBankNotify } = require("../../utils/mergeCaseForBankNotify");
const { applyExcelContactsToCase } = require("../../utils/excelNotifyContacts");
const UploadBatch = require("../uploads/uploadBatch.model");
const { getExcelColumnOrder } = require("../../utils/excelSheetDisplay");

const TRACE_REPORT_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

const saveInventoryFiles = (files, companyId, confirmationId, subfolder) => {
  if (!files?.length) return [];
  const dir = path.join(
    __dirname,
    "../../../uploads",
    "inventory",
    String(companyId),
    String(confirmationId),
    subfolder
  );
  fs.mkdirSync(dir, { recursive: true });

  return files.map((file) => {
    const ext = path.extname(file.originalname || "") || "";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, file.buffer);
    return `inventory/${companyId}/${confirmationId}/${subfolder}/${filename}`;
  });
};

const mapConfirmationRow = (doc, caseDoc) => ({
  _id: doc._id,
  caseId: doc.caseId,
  status: doc.status,
  finalAction: doc.finalAction,
  requestNote: doc.requestNote,
  reviewNote: doc.reviewNote,
  photos: doc.photos || [],
  inventoryImages: doc.inventoryImages || [],
  inventoryVideos: doc.inventoryVideos || [],
  inventoryPdfs: doc.inventoryPdfs || [],
  inventorySubmittedAt: doc.inventorySubmittedAt || null,
  inventorySubmitted: Boolean(doc.inventorySubmittedAt),
  inventoryRevisionRequested: Boolean(doc.inventoryRevisionRequested),
  inventoryRevisionNote: doc.inventoryRevisionNote || "",
  inventoryRevisionRequestedAt: doc.inventoryRevisionRequestedAt || null,
  inventoryConfirmedAt: doc.inventoryConfirmedAt || null,
  inventoryConfirmed: Boolean(doc.inventoryConfirmedAt),
  inventoryConfirmedBy: doc.inventoryConfirmedBy || null,
  requestedBy: doc.requestedBy,
  requestedByName: doc.requestedByName,
  requestedByRole: doc.requestedByRole,
  requestedByPhone: doc.requestedByPhone,
  requestedByRoleLabel: formatRepoRole(doc.requestedByRole),
  traceMode: doc.traceMode || "ONLINE",
  shareChannel: doc.shareChannel || null,
  createdAt: doc.createdAt,
  caseCode: caseDoc?.caseCode || "",
  vehicleNumber: caseDoc?.vehicleNumber || "",
  customerName: caseDoc?.customerName || "",
  bankName: caseDoc?.bankName || "",
  branchName: caseDoc?.branchName || "",
});

async function findCompanyAdmin(companyId) {
  return User.findOne({
    companyId,
    role: "REPO_ADMIN",
    isActive: { $ne: false },
  })
    .select("name phone email")
    .lean();
}

exports.createConfirmation = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const requestNote = String(req.body.requestNote || req.body.note || "").trim();
    const traceModeRaw = String(req.body.traceMode || "ONLINE").toUpperCase();
    const traceMode = traceModeRaw === "OFFLINE" ? "OFFLINE" : "ONLINE";
    const shareChannelRaw = String(req.body.shareChannel || "").toLowerCase();
    const shareChannel = ["whatsapp", "email", "sms", "app"].includes(shareChannelRaw)
      ? shareChannelRaw
      : null;

    const caseDoc = await resolveRepoCaseForTrace(
      companyId,
      {
        caseId: req.body.caseId,
        searchItem: req.body.searchItem,
      },
      req.user.userId
    );

    if (!caseDoc) {
      return res.status(400).json({
        success: false,
        message: "Vehicle not found. Search again or ensure upload data includes vehicle/loan number.",
      });
    }

    const caseId = caseDoc._id;

    const reporter = await User.findById(req.user.userId).select("name phone role").lean();

    const confirmation = await Confirmation.create({
      companyId,
      caseId,
      requestNote,
      traceMode,
      shareChannel,
      photos: [],
      requestedBy: req.user.userId,
      requestedByName: reporter?.name || req.user.name,
      requestedByRole: reporter?.role || req.user.role,
      requestedByPhone: reporter?.phone || "",
      status: "PENDING",
    });

    await RepoCase.updateOne(
      { _id: caseId, companyId },
      {
        repoStatus: "PENDING_CONFIRMATION",
        confirmationStatus: "PENDING",
        lastActionAt: new Date(),
        updatedBy: req.user.userId,
      }
    );

    const admin = await findCompanyAdmin(companyId);
    const traceMessage = buildTraceReportToAdminText(caseDoc, {
      name: confirmation.requestedByName,
      role: confirmation.requestedByRole,
      phone: confirmation.requestedByPhone,
    }, { requestNote, reportedAt: confirmation.createdAt });

    if (admin?._id) {
      await Notification.create({
        companyId,
        userId: admin._id,
        type: "VEHICLE_TRACED",
        title: `Vehicle traced: ${caseDoc.vehicleNumber || caseDoc.caseCode}`,
        message: `${confirmation.requestedByName} (${formatRepoRole(confirmation.requestedByRole)}) reported a traced vehicle.`,
        meta: {
          caseId,
          confirmationId: confirmation._id,
          vehicleNumber: caseDoc.vehicleNumber,
        },
      });
    }

    const adminWhatsAppUrl = buildWhatsAppUrl(admin?.phone, traceMessage);

    return res.status(201).json({
      success: true,
      data: mapConfirmationRow(confirmation.toObject(), caseDoc),
      traceReport: {
        message: traceMessage,
        adminName: admin?.name || "",
        adminPhone: admin?.phone || "",
        whatsAppUrl: adminWhatsAppUrl,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllConfirmations = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const query = { companyId };

    if (TRACE_REPORT_ROLES.includes(req.user.role)) {
      query.requestedBy = new mongoose.Types.ObjectId(String(req.user.userId));
    }

    if (req.query.status) {
      query.status = String(req.query.status).trim().toUpperCase();
    }

    const list = await Confirmation.find(query).sort({ createdAt: -1 }).lean();
    const caseIds = [
      ...new Set(
        list
          .map((item) => item.caseId)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      ),
    ];
    const cases = caseIds.length
      ? await RepoCase.find({ _id: { $in: caseIds }, companyId }).lean()
      : [];
    const caseMap = Object.fromEntries(cases.map((c) => [String(c._id), c]));

    return res.json({
      success: true,
      data: list.map((item) => mapConfirmationRow(item, caseMap[String(item.caseId)])),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.reviewConfirmation = async (req, res) => {
  try {
    const { id } = req.params;
    const action = String(req.body.action || "").toUpperCase();
    const reviewNote = String(req.body.note || "").trim();
    const companyId = req.user.companyId;

    const confirmation = await Confirmation.findOne({ _id: id, companyId });
    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found.",
      });
    }

    let status = "CONFIRMED";
    let finalAction = action;
    if (action === "REJECT" || action === "CANCEL") {
      status = "REJECTED";
      finalAction = "REJECT";
    } else if (action === "CONFIRM") {
      status = "CONFIRMED";
      finalAction = "CONFIRM";
    } else if (action === "IN_YARD" || action === "RELEASE") {
      status = "CONFIRMED";
      finalAction = action;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid action.",
      });
    }

    confirmation.status = status;
    confirmation.finalAction = finalAction;
    confirmation.reviewNote = reviewNote;
    confirmation.reviewedBy = req.user.userId;
    confirmation.reviewedAt = new Date();
    await confirmation.save();

    const caseUpdate = {
      confirmationStatus: status === "REJECTED" ? "REJECTED" : "CONFIRMED",
      lastActionAt: new Date(),
      updatedBy: req.user.userId,
    };
    if (action === "IN_YARD" || action === "RELEASE") {
      caseUpdate.repoStatus = "RESOLVED";
    } else if (action === "CONFIRM") {
      caseUpdate.repoStatus = "IN_PROGRESS";
    } else if (action === "REJECT" || action === "CANCEL") {
      caseUpdate.repoStatus = "IN_PROGRESS";
    }
    await RepoCase.updateOne({ _id: confirmation.caseId, companyId }, caseUpdate);

    const caseDoc = await RepoCase.findById(confirmation.caseId).lean();
    const vehicleLabel =
      caseDoc?.vehicleNumber || caseDoc?.caseCode || confirmation.caseId?.toString() || "vehicle";
    const adminName = req.user.name || "Admin";
    const isCancelled = action === "REJECT" || action === "CANCEL";

    if (confirmation.requestedBy) {
      const noteSuffix = reviewNote ? (isCancelled ? ` Reason: ${reviewNote}` : ` Note: ${reviewNote}`) : "";

      if (isCancelled) {
        await Notification.create({
          companyId,
          userId: confirmation.requestedBy,
          type: "TRACE_CANCELLED",
          title: `Trace cancelled: ${vehicleLabel}`,
          message: `${adminName} cancelled your trace report for ${vehicleLabel}.${noteSuffix}`,
          meta: {
            caseId: confirmation.caseId,
            confirmationId: confirmation._id,
            vehicleNumber: caseDoc?.vehicleNumber || "",
            action: "CANCEL",
          },
        });
      } else {
        await Notification.create({
          companyId,
          userId: confirmation.requestedBy,
          type: "TRACE_CONFIRMED",
          title: `Trace confirmed: ${vehicleLabel}`,
          message: `Please update inventory prepost.${noteSuffix ? ` ${noteSuffix.trim()}` : ""}`,
          meta: {
            caseId: confirmation.caseId,
            confirmationId: confirmation._id,
            vehicleNumber: caseDoc?.vehicleNumber || "",
            action: "INVENTORY_UPDATE",
            reviewAction: action,
          },
        });
      }
    }

    return res.json({
      success: true,
      data: mapConfirmationRow(confirmation.toObject(), caseDoc),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateConfirmationStatus = exports.reviewConfirmation;

exports.getConfirmationById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const confirmation = await Confirmation.findOne({
      _id: req.params.id,
      companyId,
    }).lean();

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found.",
      });
    }

    const isAdmin = req.user.role === "REPO_ADMIN";
    const isTracer =
      String(confirmation.requestedBy) === String(req.user.userId);

    if (!isAdmin && !isTracer) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this confirmation.",
      });
    }

    const caseDoc = await RepoCase.findOne({
      _id: confirmation.caseId,
      companyId,
    }).lean();

    let enrichedCase = caseDoc ? { ...caseDoc } : null;
    if (enrichedCase) {
      enrichedCase = applyExcelContactsToCase(enrichedCase);
      const contacts = extractExcelNotifyContacts(enrichedCase);
      if (!hasBankerNotifyContacts(contacts)) {
        const uploadRow = await resolveFullUploadRowWithTimeout(companyId, enrichedCase, 8000);
        if (uploadRow) {
          enrichedCase = applyExcelContactsToCase(
            mergeCaseForBankNotify(enrichedCase, uploadRow)
          );
        }
      }

      let excelColumnOrder = getExcelColumnOrder(enrichedCase.excelFields || {});
      if (!excelColumnOrder.length && enrichedCase.uploadBatchId) {
        const batch = await UploadBatch.findOne({
          _id: enrichedCase.uploadBatchId,
          companyId,
        })
          .select("columnNames")
          .lean();
        excelColumnOrder = batch?.columnNames || [];
      }
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
    }

    return res.json({
      success: true,
      data: {
        confirmation: mapConfirmationRow(confirmation, caseDoc),
        case: enrichedCase,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const INVENTORY_MAX_TOTAL = {
  images: 30,
  videos: 15,
  pdfs: 15,
};

exports.submitInventory = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const confirmation = await Confirmation.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found.",
      });
    }

    if (String(confirmation.requestedBy) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the tracer who reported this vehicle can submit inventory.",
      });
    }

    if (confirmation.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Inventory can only be submitted after admin confirms the trace.",
      });
    }

    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];
    const pdfFiles = req.files?.pdfs || [];

    if (!imageFiles.length && !videoFiles.length && !pdfFiles.length) {
      return res.status(400).json({
        success: false,
        message: "Upload at least one image, video, or PDF.",
      });
    }

    const nextImageTotal = (confirmation.inventoryImages?.length || 0) + imageFiles.length;
    const nextVideoTotal = (confirmation.inventoryVideos?.length || 0) + videoFiles.length;
    const nextPdfTotal = (confirmation.inventoryPdfs?.length || 0) + pdfFiles.length;

    if (nextImageTotal > INVENTORY_MAX_TOTAL.images) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${INVENTORY_MAX_TOTAL.images} images allowed in total.`,
      });
    }
    if (nextVideoTotal > INVENTORY_MAX_TOTAL.videos) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${INVENTORY_MAX_TOTAL.videos} videos allowed in total.`,
      });
    }
    if (nextPdfTotal > INVENTORY_MAX_TOTAL.pdfs) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${INVENTORY_MAX_TOTAL.pdfs} PDFs allowed in total.`,
      });
    }

    const hadInventoryBefore = Boolean(confirmation.inventorySubmittedAt);

    const images = saveInventoryFiles(
      imageFiles,
      companyId,
      confirmation._id,
      "images"
    );
    const videos = saveInventoryFiles(
      videoFiles,
      companyId,
      confirmation._id,
      "videos"
    );
    const pdfs = saveInventoryFiles(pdfFiles, companyId, confirmation._id, "pdfs");

    confirmation.inventoryImages = [...(confirmation.inventoryImages || []), ...images];
    confirmation.inventoryVideos = [...(confirmation.inventoryVideos || []), ...videos];
    confirmation.inventoryPdfs = [...(confirmation.inventoryPdfs || []), ...pdfs];
    confirmation.inventorySubmittedAt = new Date();
    confirmation.inventorySubmittedBy = req.user.userId;
    confirmation.inventoryRevisionRequested = false;
    confirmation.inventoryRevisionNote = "";
    confirmation.inventoryRevisionRequestedAt = null;
    confirmation.inventoryConfirmedAt = null;
    confirmation.inventoryConfirmedBy = null;
    await confirmation.save();

    const caseDoc = await RepoCase.findById(confirmation.caseId).lean();
    const admin = await findCompanyAdmin(companyId);
    const vehicleLabel =
      caseDoc?.vehicleNumber || caseDoc?.caseCode || confirmation.caseId?.toString() || "vehicle";

    if (admin?._id) {
      await Notification.create({
        companyId,
        userId: admin._id,
        type: "INVENTORY_SUBMITTED",
        title: `Inventory updated: ${vehicleLabel}`,
        message: hadInventoryBefore
          ? `${confirmation.requestedByName || "Tracer"} added more inventory files for ${vehicleLabel}.`
          : `${confirmation.requestedByName || "Tracer"} submitted inventory pre/post files for ${vehicleLabel}.`,
        meta: {
          caseId: confirmation.caseId,
          confirmationId: confirmation._id,
          vehicleNumber: caseDoc?.vehicleNumber || "",
        },
      });
    }

    return res.json({
      success: true,
      data: mapConfirmationRow(confirmation.toObject(), caseDoc),
      message: hadInventoryBefore
        ? "Additional inventory files uploaded successfully."
        : "Inventory pre/post files uploaded successfully. Waiting for admin approval.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.confirmInventory = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const confirmation = await Confirmation.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found.",
      });
    }

    if (confirmation.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Inventory can only be confirmed after the trace is confirmed.",
      });
    }

    if (!confirmation.inventorySubmittedAt) {
      return res.status(400).json({
        success: false,
        message: "Tracer has not submitted inventory yet.",
      });
    }

    const hasFiles =
      (confirmation.inventoryImages?.length || 0) +
        (confirmation.inventoryVideos?.length || 0) +
        (confirmation.inventoryPdfs?.length || 0) >
      0;

    if (!hasFiles) {
      return res.status(400).json({
        success: false,
        message: "No inventory files to confirm.",
      });
    }

    if (confirmation.inventoryConfirmedAt) {
      return res.status(400).json({
        success: false,
        message: "Inventory is already confirmed.",
      });
    }

    confirmation.inventoryConfirmedAt = new Date();
    confirmation.inventoryConfirmedBy = req.user.userId;
    confirmation.inventoryRevisionRequested = false;
    confirmation.inventoryRevisionNote = "";
    confirmation.inventoryRevisionRequestedAt = null;
    await confirmation.save();

    const caseDoc = await RepoCase.findById(confirmation.caseId).lean();
    const vehicleLabel =
      caseDoc?.vehicleNumber || caseDoc?.caseCode || confirmation.caseId?.toString() || "vehicle";
    const adminName = req.user.name || "Admin";

    if (confirmation.requestedBy) {
      await Notification.create({
        companyId,
        userId: confirmation.requestedBy,
        type: "INVENTORY_CONFIRMED",
        title: `Inventory confirmed: ${vehicleLabel}`,
        message: `${adminName} approved your inventory upload for ${vehicleLabel}.`,
        meta: {
          caseId: confirmation.caseId,
          confirmationId: confirmation._id,
          vehicleNumber: caseDoc?.vehicleNumber || "",
        },
      });
    }

    return res.json({
      success: true,
      data: mapConfirmationRow(confirmation.toObject(), caseDoc),
      message: "Inventory confirmed successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.requestInventoryRevision = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const note = String(req.body.note || "").trim();

    const confirmation = await Confirmation.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found.",
      });
    }

    if (confirmation.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Inventory revision can only be requested for confirmed traces.",
      });
    }

    confirmation.inventoryRevisionRequested = true;
    confirmation.inventoryRevisionNote = note;
    confirmation.inventoryRevisionRequestedAt = new Date();
    confirmation.inventoryConfirmedAt = null;
    confirmation.inventoryConfirmedBy = null;
    await confirmation.save();

    const caseDoc = await RepoCase.findById(confirmation.caseId).lean();
    const vehicleLabel =
      caseDoc?.vehicleNumber || caseDoc?.caseCode || confirmation.caseId?.toString() || "vehicle";
    const adminName = req.user.name || "Admin";
    const noteSuffix = note ? ` Note: ${note}` : "";

    if (confirmation.requestedBy) {
      await Notification.create({
        companyId,
        userId: confirmation.requestedBy,
        type: "INVENTORY_REVISION_REQUESTED",
        title: `Update inventory: ${vehicleLabel}`,
        message: `${adminName} asked you to add or correct inventory files.${noteSuffix}`,
        meta: {
          caseId: confirmation.caseId,
          confirmationId: confirmation._id,
          vehicleNumber: caseDoc?.vehicleNumber || "",
          action: "INVENTORY_UPDATE",
        },
      });
    }

    return res.json({
      success: true,
      data: mapConfirmationRow(confirmation.toObject(), caseDoc),
      message: "Tracer notified to update inventory.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getConfirmationsCount = async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
      status: "CONFIRMED",
    };

    // Tracer roles should only see their own confirmations in stats.
    if (TRACE_REPORT_ROLES.includes(req.user.role)) {
      query.requestedBy = new mongoose.Types.ObjectId(String(req.user.userId));
    }

    const count = await Confirmation.countDocuments(query);
    return res.json({
      success: true,
      data: { totalConfirmations: count, confirmedConfirmations: count },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getInventoryConfirmedCount = async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
      status: "CONFIRMED",
      inventoryConfirmedAt: { $ne: null },
    };

    if (TRACE_REPORT_ROLES.includes(req.user.role)) {
      query.requestedBy = new mongoose.Types.ObjectId(String(req.user.userId));
    }

    const count = await Confirmation.countDocuments(query);
    return res.json({
      success: true,
      data: { inventoryConfirmed: count },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getPendingConfirmationsCount = async (req, res) => {
  try {
    const query = {
      companyId: req.user.companyId,
      status: "PENDING",
      $or: [
        { shareChannel: { $in: ["whatsapp", "email", "sms", "app"] } },
        { shareChannel: null },
        { shareChannel: { $exists: false } },
      ],
    };

    // Tracer roles should only see their own pending confirmations in stats.
    if (TRACE_REPORT_ROLES.includes(req.user.role)) {
      query.requestedBy = new mongoose.Types.ObjectId(String(req.user.userId));
    }

    const count = await Confirmation.countDocuments(query);
    return res.json({
      success: true,
      data: { pendingConfirmations: count },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
