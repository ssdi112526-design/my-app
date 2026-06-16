const express = require("express");
const router = express.Router();
const controller = require("./notification.controller");
const { protect } = require("../../middlewares/auth");

router.use(protect);

router.get("/", controller.getMyNotifications);
router.patch("/read-all", controller.markAllNotificationsRead);
router.patch("/:id/read", controller.markNotificationRead);

module.exports = router;
