const express = require("express");
const router = express.Router();
const controller = require("./finance.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");

router.use(protect, authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"), requireCompanyUser);

router.post("/", authorize("REPO_ADMIN", "REPO_STAFF"), controller.createFinanceEntry);
router.get("/", controller.getFinanceEntries);
router.get("/summary", controller.getFinanceSummary);

module.exports = router;