const mongoose = require("mongoose");
const RepoCase = require("../repoCases/repoCase.model");
const User = require("../users/user.model");
const LocationSnapshot = require("../locationSnapshots/locationSnapshot.model");
const {
  FIELD_TRACE_STATUSES,
  FIELD_TRACE_STATUS_LABELS,
} = require("../../constants/fieldTraceStatuses");
const { writeAuditLog } = require("../../utils/auditLog");

/** Roles that can read case tracking (timeline, locations, fleet map). */
const TRACE_VIEW_ROLES = ["REPO_ADMIN", "TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF", "REPO_VIEWER"];

/** Roles that can post GPS for a case (field tracers). */
const TRACE_SEND_ROLES = ["REPO_STAFF", "TEAM_LEADER"];

/** Roles that share live app GPS on the fleet map. */
const LIVE_LOCATION_ROLES = ["REPO_STAFF", "TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF"];

/** Roles that can open the company fleet map (all / team tracers). */
const FLEET_MAP_ROLES = ["REPO_ADMIN", "TEAM_LEADER"];

/** @deprecated use TRACE_VIEW_ROLES / TRACE_SEND_ROLES */
const TRACE_FIELD_ROLES = [...new Set([...TRACE_VIEW_ROLES, ...TRACE_SEND_ROLES, "REPO_STAFF"])];

const LIVE_TRACER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function updateUserLastKnownLocation(userId, payload) {
  await User.findByIdAndUpdate(userId, { lastKnownLocation: payload });
}

function emitTracerLocation(companyId, data) {
  const { getIO } = require("../../socket");
  const io = getIO();
  if (io && companyId) {
    io.to(`company:${companyId}`).emit("tracer:location", data);
  }
}

function pushTimeline(caseDoc, entry) {
  if (!Array.isArray(caseDoc.caseTimeline)) {
    caseDoc.caseTimeline = [];
  }
  caseDoc.caseTimeline.push({
    ...entry,
    at: new Date(),
    byUserId: entry.byUserId,
    byName: entry.byName || "",
  });
  if (caseDoc.caseTimeline.length > 200) {
    caseDoc.caseTimeline = caseDoc.caseTimeline.slice(-200);
  }
}

async function loadCompanyCase(caseId, companyId) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    return { error: { status: 400, message: "Invalid case id." } };
  }
  const caseDoc = await RepoCase.findOne({ _id: caseId, companyId });
  if (!caseDoc) {
    return { error: { status: 404, message: "Case not found." } };
  }
  return { caseDoc };
}

const postCaseLocation = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { caseDoc, error } = await loadCompanyCase(req.params.id, companyId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    const snapshot = await LocationSnapshot.create({
      companyId,
      caseId: caseDoc._id,
      tracerId: req.user.userId,
      tracerName: req.user.name || "",
      latitude: lat,
      longitude: lng,
      accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : null,
      heading: req.body.heading != null ? Number(req.body.heading) : null,
      speed: req.body.speed != null ? Number(req.body.speed) : null,
      source: req.body.source === "MANUAL" ? "MANUAL" : "GPS",
      note: String(req.body.note || "").trim(),
    });

    caseDoc.lastKnownLocation = {
      latitude: lat,
      longitude: lng,
      accuracy: snapshot.accuracy,
      updatedAt: new Date(),
      tracerId: req.user.userId,
      tracerName: req.user.name || "",
    };
    pushTimeline(caseDoc, {
      type: "LOCATION",
      byUserId: req.user.userId,
      byName: req.user.name,
      summary: `Location updated (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
    });
    caseDoc.updatedBy = req.user.userId;
    await caseDoc.save();

    const tracerLocation = {
      latitude: lat,
      longitude: lng,
      accuracy: snapshot.accuracy,
      updatedAt: new Date(),
      activeCaseId: caseDoc._id,
      vehicleNumber: caseDoc.vehicleNumber || "",
    };
    await updateUserLastKnownLocation(req.user.userId, tracerLocation);

    emitTracerLocation(companyId, {
      tracerId: String(req.user.userId),
      tracerName: req.user.name || "",
      role: req.user.role,
      latitude: lat,
      longitude: lng,
      accuracy: snapshot.accuracy,
      updatedAt: tracerLocation.updatedAt,
      caseId: String(caseDoc._id),
      vehicleNumber: tracerLocation.vehicleNumber,
    });

    await writeAuditLog({
      companyId,
      userId: req.user.userId,
      userName: req.user.name,
      role: req.user.role,
      action: "CASE_LOCATION_UPDATE",
      entity: "RepoCase",
      entityId: caseDoc._id,
      meta: { latitude: lat, longitude: lng },
    });

    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.to(`company:${companyId}`).emit("case:location", {
        caseId: String(caseDoc._id),
        snapshot,
      });
    }

    return res.json({ success: true, data: { snapshot, lastKnownLocation: caseDoc.lastKnownLocation } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const patchTraceStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const traceStatus = String(req.body.traceStatus || "").toUpperCase();
    if (!FIELD_TRACE_STATUSES.includes(traceStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid trace status. Allowed: ${FIELD_TRACE_STATUSES.join(", ")}`,
      });
    }

    const { caseDoc, error } = await loadCompanyCase(req.params.id, companyId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const previous = caseDoc.traceStatus || "PENDING";
    caseDoc.traceStatus = traceStatus;
    if (req.body.note) {
      caseDoc.fieldNotes = String(req.body.note).trim();
    }
    pushTimeline(caseDoc, {
      type: "TRACE_STATUS",
      byUserId: req.user.userId,
      byName: req.user.name,
      summary: `Trace status: ${FIELD_TRACE_STATUS_LABELS[previous] || previous} → ${FIELD_TRACE_STATUS_LABELS[traceStatus]}`,
      traceStatus,
      previousTraceStatus: previous,
    });
    caseDoc.lastActionAt = new Date();
    caseDoc.updatedBy = req.user.userId;
    await caseDoc.save();

    await writeAuditLog({
      companyId,
      userId: req.user.userId,
      userName: req.user.name,
      role: req.user.role,
      action: "CASE_TRACE_STATUS",
      entity: "RepoCase",
      entityId: caseDoc._id,
      meta: { traceStatus, previous },
    });

    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.to(`company:${companyId}`).emit("case:trace-status", {
        caseId: String(caseDoc._id),
        traceStatus,
      });
    }

    return res.json({
      success: true,
      data: {
        caseId: caseDoc._id,
        traceStatus: caseDoc.traceStatus,
        traceStatusLabel: FIELD_TRACE_STATUS_LABELS[traceStatus],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getCaseLocations = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { error } = await loadCompanyCase(req.params.id, companyId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const items = await LocationSnapshot.find({
      companyId,
      caseId: req.params.id,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getCaseTimeline = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { caseDoc, error } = await loadCompanyCase(req.params.id, companyId);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      data: {
        traceStatus: caseDoc.traceStatus,
        lastKnownLocation: caseDoc.lastKnownLocation,
        timeline: caseDoc.caseTimeline || [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const postMeLocation = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company not found." });
    }

    const lat = Number(req.body.latitude);
    const lng = Number(req.body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    const user = await User.findOne({ _id: req.user.userId, companyId }).select(
      "lastKnownLocation name phone post role"
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const prev = user.lastKnownLocation || {};
    const tracerLocation = {
      latitude: lat,
      longitude: lng,
      accuracy: req.body.accuracy != null ? Number(req.body.accuracy) : null,
      updatedAt: new Date(),
      activeCaseId: prev.activeCaseId || null,
      vehicleNumber: prev.vehicleNumber || "",
    };

    await updateUserLastKnownLocation(req.user.userId, tracerLocation);

    emitTracerLocation(companyId, {
      tracerId: String(req.user.userId),
      tracerName: user.name || "",
      name: user.name || "",
      phone: user.phone || "",
      post: user.post || "",
      role: user.role,
      latitude: lat,
      longitude: lng,
      accuracy: tracerLocation.accuracy,
      updatedAt: tracerLocation.updatedAt,
      caseId: tracerLocation.activeCaseId ? String(tracerLocation.activeCaseId) : null,
      vehicleNumber: tracerLocation.vehicleNumber,
    });

    return res.json({ success: true, data: { lastKnownLocation: tracerLocation } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTraceStatusOptions = async (_req, res) => {
  return res.json({
    success: true,
    data: FIELD_TRACE_STATUSES.map((id) => ({
      id,
      label: FIELD_TRACE_STATUS_LABELS[id],
    })),
  });
};

const getLiveTracers = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company not found." });
    }

    const since = new Date(Date.now() - LIVE_TRACER_MAX_AGE_MS);
    const baseQuery = {
      companyId,
      isActive: true,
      "lastKnownLocation.latitude": { $ne: null },
      "lastKnownLocation.longitude": { $ne: null },
      "lastKnownLocation.updatedAt": { $gte: since },
    };

    if (req.user.role === "TEAM_LEADER") {
      const assignedCount = await User.countDocuments({
        companyId,
        role: "REPO_STAFF",
        isActive: true,
        teamLeaderId: req.user.userId,
      });

      const orClause = [
        { role: { $in: ["TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF"] } },
      ];

      if (assignedCount > 0) {
        orClause.push({ role: "REPO_STAFF", teamLeaderId: req.user.userId });
      } else {
        orClause.push({ role: "REPO_STAFF" });
      }

      baseQuery.$or = orClause;
    } else {
      baseQuery.role = { $in: LIVE_LOCATION_ROLES };
    }

    const tracers = await User.find(baseQuery)
      .select("name phone post role lastKnownLocation teamLeaderId")
      .sort({ "lastKnownLocation.updatedAt": -1 })
      .lean();

    const items = tracers.map((u) => ({
      tracerId: String(u._id),
      name: u.name,
      phone: u.phone || "",
      post: u.post || "",
      role: u.role,
      latitude: u.lastKnownLocation?.latitude,
      longitude: u.lastKnownLocation?.longitude,
      accuracy: u.lastKnownLocation?.accuracy,
      updatedAt: u.lastKnownLocation?.updatedAt,
      caseId: u.lastKnownLocation?.activeCaseId
        ? String(u.lastKnownLocation.activeCaseId)
        : null,
      vehicleNumber: u.lastKnownLocation?.vehicleNumber || "",
    }));

    return res.json({ success: true, data: { items, refreshedAt: new Date() } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  TRACE_FIELD_ROLES,
  TRACE_VIEW_ROLES,
  TRACE_SEND_ROLES,
  LIVE_LOCATION_ROLES,
  FLEET_MAP_ROLES,
  postCaseLocation,
  postMeLocation,
  patchTraceStatus,
  getCaseLocations,
  getCaseTimeline,
  getTraceStatusOptions,
  getLiveTracers,
};
