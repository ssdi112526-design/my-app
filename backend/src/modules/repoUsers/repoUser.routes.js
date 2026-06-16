const express = require("express");
const router = express.Router();
const controller = require("./repoUser.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const { validateObjectId } = require("../../middlewares/validateObjectId");

router.use(protect, authorize("REPO_ADMIN"), requireCompanyUser);

router.post("/phone/send-otp", controller.sendUserPhoneOtp);
router.post("/phone/verify-otp", controller.verifyUserPhoneOtp);
router.get("/connect-eligibility", controller.getConnectEligibilityHandler);
router.post("/", controller.createRepoUser);
router.get("/", controller.getRepoUsers);

const userId = validateObjectId("id");

router.get("/:id", userId, controller.getRepoUserById);
router.put("/:id", userId, controller.updateRepoUser);
router.patch("/:id/status", userId, controller.changeRepoUserStatus);
router.post("/:id/reset-password", userId, controller.resetRepoUserPassword);

module.exports = router;
