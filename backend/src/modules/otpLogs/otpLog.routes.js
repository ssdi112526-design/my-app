const express = require("express");
const router = express.Router();
const controller = require("./otpLog.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");

router.use(protect, authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"), requireCompanyUser);

router.post("/", authorize("REPO_ADMIN", "REPO_STAFF"), controller.createOtpLog);
router.get("/", controller.getOtpLogs);
router.post("/:id/verify", authorize("REPO_ADMIN", "REPO_STAFF"), controller.verifyOtpLog);

module.exports = router;