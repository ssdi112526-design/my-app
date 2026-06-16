const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("./upload.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect, requireCompanyUser);

router.post(
  "/repo-cases/preview",
  authorize("REPO_ADMIN"),
  upload.single("file"),
  controller.previewRepoCases
);
router.post(
  "/repo-cases",
  authorize("REPO_ADMIN"),
  upload.single("file"),
  controller.uploadRepoCases
);
router.post("/s3/presign", authorize("REPO_ADMIN"), (req, res, next) =>
  controller.presignS3Upload(req, res, next)
);
router.post("/s3/complete", authorize("REPO_ADMIN"), (req, res, next) =>
  controller.completeS3Upload(req, res, next)
);

router.get("/", controller.getUploads);
router.delete("/:id", authorize("REPO_ADMIN"), controller.deleteUploadBatch);
router.get("/:id/vehicle-numbers", controller.getUploadVehicleNumbers);
router.get("/:id/file", controller.downloadUploadFile);
router.get("/:id", controller.getUploadById);

module.exports = router;