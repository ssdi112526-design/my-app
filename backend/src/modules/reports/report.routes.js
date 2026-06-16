const express = require("express");
const router = express.Router();
const controller = require("./report.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");

router.use(protect, authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"), requireCompanyUser);

router.get("/status-wise", controller.getStatusWiseReport);
router.get("/user-wise", controller.getUserWiseReport);
router.get("/bank-wise", controller.getBankWiseReport);
router.get("/otp", controller.getOtpReport);
router.get("/blacklist", controller.getBlacklistReport);
router.get("/confirmations", controller.getConfirmationReport);

module.exports = router;