const express = require("express");
const router = express.Router();
const controller = require("./repoCase.controller");
const {
  protect,
  authorize,
  requireCompanyUser,
} = require("../../middlewares/auth");
router.use(protect, requireCompanyUser);

router.post("/", authorize("REPO_ADMIN", "REPO_STAFF"), controller.createRepoCase);
/* Any active user in the company can read/search cases (Excel uploads visible to field staff). */
router.get("/stats/overview", controller.getStatsOverview);
router.get("/stats/today-activity", controller.getTodayActivity);
router.get("/search/warm", controller.warmSearchCache);
router.get("/search/status", controller.getSearchCacheStatus);
// Lookup latest tracer ("who traced it") by vehicle number.
router.get(
  "/trace-by-vehicle-number",
  controller.getTracedByVehicleNumber
);
router.get("/vehicle-loaded", controller.getVehicleLoaded);
router.put("/vehicle-loaded", controller.saveVehicleLoaded);
router.post(
  "/bank-notify-message",
  authorize("REPO_ADMIN"),
  controller.getBankNotifyMessage
);
router.get("/", controller.getRepoCases);
router.get("/:id", controller.getRepoCaseById);
router.post(
  "/:id/remarks",
  authorize("REPO_ADMIN", "REPO_STAFF"),
  controller.addRemarkToRepoCase
);
router.post(
  "/:id/notify-bank-traced",
  authorize("REPO_ADMIN"),
  controller.notifyBankTraced
);

module.exports = router;