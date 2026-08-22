const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("./upload.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const {
  isAllowedUploadFileName,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} = require("./uploadFileValidation");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!isAllowedUploadFileName(file.originalname)) {
      const err = new Error("Only .xlsx, .xls, and .csv files are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

function handleMulter(req, res, next) {
  return upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : err.statusCode || 400).json({
      success: false,
      message: tooLarge
        ? require("./uploadFileValidation").oversizedUploadMessage()
        : err.message || "Invalid upload.",
    });
  });
}

router.use(protect, requireCompanyUser);

router.post(
  "/repo-cases/preview",
  authorize("REPO_ADMIN"),
  handleMulter,
  controller.previewRepoCases
);
router.post(
  "/repo-cases",
  authorize("REPO_ADMIN"),
  handleMulter,
  controller.uploadRepoCases
);
router.post("/s3/presign", authorize("REPO_ADMIN"), (req, res, next) =>
  controller.presignS3Upload(req, res, next)
);
router.post(
  "/s3/proxy",
  authorize("REPO_ADMIN"),
  handleMulter,
  controller.proxyS3Upload
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
