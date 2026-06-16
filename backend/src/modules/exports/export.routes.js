const express = require("express");
const router = express.Router();

const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const companyController = require("../companies/company.controller");
const repoUserController = require("../repoUsers/repoUser.controller");
const blacklistController = require("../blacklist/blacklist.controller");

// Dedicated export URLs — avoids /api/companies/:id catching "download-excel"

router.get(
  "/companies",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  companyController.exportCompanies
);

router.get(
  "/repo-users",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  repoUserController.exportRepoUsers
);

router.get(
  "/blacklist",
  protect,
  authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"),
  requireCompanyUser,
  blacklistController.exportBlacklistEntries
);

module.exports = router;
