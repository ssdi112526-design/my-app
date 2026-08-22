const router = require("express").Router();
const multer = require("multer");
const controller = require("./auth.controller");
const companyController = require("../companies/company.controller");
const { protect, authorize } = require("../../middlewares/auth");

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/login", controller.login); // optional generic login
router.post("/ssdi-login", controller.ssdiLogin);
router.post("/repo-agent-login", controller.repoAgentLogin);
router.post("/agent-register", controller.agentSelfRegister);
router.post("/bootstrap-ssdi-admin", controller.bootstrapSSDIAdmin);

router.post("/refresh", protect, controller.refresh);
router.get("/profile", protect, controller.getProfile);
router.patch("/profile", protect, controller.updateProfile);
router.post(
  "/profile/photo",
  protect,
  profilePhotoUpload.single("photo"),
  controller.uploadProfilePhoto
);
router.get("/id-card-data", protect, controller.getIdCardData);

router.post(
  "/ssdi/repo-admin-phone/send-otp",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  companyController.sendRepoAdminPhoneOtp
);
router.post(
  "/ssdi/repo-admin-phone/verify-otp",
  protect,
  authorize("SSDI_SUPER_ADMIN"),
  companyController.verifyRepoAdminPhoneOtp
);

module.exports = router;