const express = require("express");
const router = express.Router();

const controller = require("./companyBank.controller");
const {
  protect,
  authorize,
  requireCompanyUser,
} = require("../../middlewares/auth");

router.use(
  protect,
  authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"),
  requireCompanyUser
);

router.get("/", controller.getCompanyBanks);

router.post(
  "/",
  authorize("REPO_ADMIN"),
  controller.createCompanyBank
);

router.post(
  "/:id/branches",
  authorize("REPO_ADMIN"),
  controller.addBranchToBank
);

router.patch(
  "/:id/status",
  authorize("REPO_ADMIN"),
  controller.updateBankStatus
);

router.patch(
  "/:id/branches/:branchId/status",
  authorize("REPO_ADMIN"),
  controller.updateBranchStatus
);

router.patch(
  "/:id/branches/:branchId/contacts",
  authorize("REPO_ADMIN"),
  controller.updateBranchContacts
);

module.exports = router;