const express = require("express");
const router = express.Router();
const controller = require("./blacklist.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");

router.get(
  "/ssdi",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  controller.listAllForSsdi
);

router.patch(
  "/ssdi/:id/remove",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  controller.removeBlacklistEntryBySsdi
);

router.use(protect, authorize("REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"), requireCompanyUser);

router.post("/", authorize("REPO_ADMIN", "REPO_STAFF"), controller.createBlacklistEntry);
router.get("/", controller.getBlacklistEntries);
router.patch("/:id/remove", authorize("REPO_ADMIN", "REPO_STAFF"), controller.removeBlacklistEntry);

module.exports = router;