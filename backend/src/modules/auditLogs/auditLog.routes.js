const express = require("express");
const router = express.Router();
const controller = require("./auditLog.controller");
const { protect, authorize } = require("../../middlewares/auth");

router.use(protect);

router.get(
  "/",
  authorize("SSDI_SUPER_ADMIN", "REPO_ADMIN"),
  controller.listAuditLogs
);

module.exports = router;
