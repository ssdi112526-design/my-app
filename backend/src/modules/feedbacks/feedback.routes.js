const express = require("express");
const router = express.Router();
const controller = require("./feedback.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const { COMPANY_USER_ROLES } = require("../../constants/repoRoles");

router.get(
  "/ssdi",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  controller.listAllForSsdi
);

router.use(protect, authorize(...COMPANY_USER_ROLES), requireCompanyUser);

router.post("/", controller.createFeedback);
router.get("/", controller.getFeedbacks);

module.exports = router;
