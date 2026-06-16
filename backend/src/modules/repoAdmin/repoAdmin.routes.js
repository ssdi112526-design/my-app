const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("./repoAdmin.controller");
const paymentController = require("../payments/payment.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const { COMPANY_USER_ROLES } = require("../../constants/repoRoles");

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/login", controller.loginRepoAdmin);

router.post(
  "/verify-control-panel",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  controller.verifyControlPanel
);

router.get(
  "/me",
  protect,
  authorize(...COMPANY_USER_ROLES),
  requireCompanyUser,
  controller.getMe
);

router.get(
  "/company",
  protect,
  authorize(...COMPANY_USER_ROLES),
  requireCompanyUser,
  controller.getMyCompany
);

router.patch(
  "/company",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  controller.updateMyCompany
);

router.post(
  "/company/photo",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  photoUpload.single("photo"),
  controller.uploadMyCompanyPhoto
);

router.get(
  "/company/export",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  controller.exportMyCompany
);

router.get(
  "/subscription",
  protect,
  authorize(...COMPANY_USER_ROLES),
  requireCompanyUser,
  controller.getMySubscription
);

router.post(
  "/subscription/connect-fee-order",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  paymentController.createConnectFeeOrder
);

router.post(
  "/subscription/verify-payment",
  protect,
  authorize("REPO_ADMIN"),
  requireCompanyUser,
  paymentController.verifyPayment
);

router.get(
  "/dashboard",
  protect,
  authorize(...COMPANY_USER_ROLES),
  requireCompanyUser,
  controller.getDashboard
);

module.exports = router;