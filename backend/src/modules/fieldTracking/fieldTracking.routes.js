const express = require("express");
const router = express.Router();
const controller = require("./fieldTracking.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const { validateObjectId } = require("../../middlewares/validateObjectId");

const caseId = validateObjectId("id");

router.use(protect, requireCompanyUser);

router.get("/trace-statuses", controller.getTraceStatusOptions);

router.post(
  "/me/location",
  authorize(...controller.LIVE_LOCATION_ROLES),
  controller.postMeLocation
);

router.get(
  "/tracers/live",
  authorize(...controller.FLEET_MAP_ROLES),
  controller.getLiveTracers
);

router.post(
  "/cases/:id/location",
  caseId,
  authorize(...controller.TRACE_SEND_ROLES),
  controller.postCaseLocation
);

router.patch(
  "/cases/:id/trace-status",
  caseId,
  authorize(...controller.TRACE_SEND_ROLES, ...controller.TRACE_VIEW_ROLES),
  controller.patchTraceStatus
);

router.get(
  "/cases/:id/locations",
  caseId,
  authorize(...controller.TRACE_VIEW_ROLES, ...controller.TRACE_SEND_ROLES),
  controller.getCaseLocations
);

router.get(
  "/cases/:id/timeline",
  caseId,
  authorize(...controller.TRACE_VIEW_ROLES, ...controller.TRACE_SEND_ROLES),
  controller.getCaseTimeline
);

module.exports = router;
