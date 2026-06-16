const express = require("express");
const multer = require("multer");
const router = express.Router();

const controller = require("./confirmation.controller");
const { protect, authorize, requireCompanyUser } = require("../../middlewares/auth");
const { validateObjectId } = require("../../middlewares/validateObjectId");

const TRACE_ROLES = [
  "REPO_ADMIN",
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

const inventoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 50 },
});

router.use(protect, requireCompanyUser);

router.post("/", authorize(...TRACE_ROLES), controller.createConfirmation);

router.get("/stats/pending-count", controller.getPendingConfirmationsCount);
router.get("/stats/inventory-confirmed-count", controller.getInventoryConfirmedCount);
router.get("/stats/count", controller.getConfirmationsCount);
router.get("/", controller.getAllConfirmations);

router.get("/:id", validateObjectId("id"), controller.getConfirmationById);

router.post(
  "/:id/inventory",
  validateObjectId("id"),
  authorize(...TRACE_ROLES),
  inventoryUpload.fields([
    { name: "images", maxCount: 30 },
    { name: "videos", maxCount: 15 },
    { name: "pdfs", maxCount: 15 },
  ]),
  controller.submitInventory
);

router.post(
  "/:id/inventory/confirm",
  validateObjectId("id"),
  authorize("REPO_ADMIN"),
  controller.confirmInventory
);

router.post(
  "/:id/inventory/request-revision",
  validateObjectId("id"),
  authorize("REPO_ADMIN"),
  controller.requestInventoryRevision
);

router.post(
  "/:id/review",
  validateObjectId("id"),
  authorize("REPO_ADMIN"),
  controller.reviewConfirmation
);
router.patch(
  "/:id",
  validateObjectId("id"),
  authorize("REPO_ADMIN"),
  controller.reviewConfirmation
);

module.exports = router;
