const express = require("express");
const multer = require("multer");
const router = express.Router();

const controller = require("./company.controller");
const { protect, authorize } = require("../../middlewares/auth");
const { validateObjectId } = require("../../middlewares/validateObjectId");

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/register", controller.registerCompanyRequest);

router.use(protect, authorize("SSDI_SUPER_ADMIN"));
// POST paths with static segments first (before /:id)
router.post("/repo-admin-phone/send-otp", controller.sendRepoAdminPhoneOtp);
router.post("/repo-admin-phone/verify-otp", controller.verifyRepoAdminPhoneOtp);
router.post("/", controller.createCompany);

// Static GET paths — never use /:id above these
router.get("/stats", controller.stats);
router.get("/registrations/pending", controller.listPendingRegistrations);
router.get("/next-code", controller.getNextCompanyCode);
router.get("/", controller.listCompanies);

const companyId = validateObjectId("id");

router.get("/:id", companyId, controller.getCompany);
router.get("/:id/users", companyId, controller.getCompanyUsers);
router.patch(
  "/:id/users/:userId/status",
  companyId,
  validateObjectId("userId"),
  controller.updateCompanyUserStatus
);
router.post("/:id/approve", companyId, controller.approveCompany);
router.post("/:id/mark-payment", companyId, controller.markCompanyPayment);
router.put("/:id", companyId, controller.updateCompany);
router.post(
  "/:id/photo",
  companyId,
  photoUpload.single("photo"),
  controller.uploadCompanyPhoto
);
router.post(
  "/:id/admin-photo",
  companyId,
  photoUpload.single("photo"),
  controller.uploadRepoAdminPhoto
);
router.delete("/:id", companyId, controller.deleteCompany);
router.post(
  "/:id/reset-repo-admin-password",
  companyId,
  controller.resetRepoAdminPassword
);

module.exports = router;
