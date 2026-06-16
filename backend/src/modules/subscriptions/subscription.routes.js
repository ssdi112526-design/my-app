const router = require("express").Router();
const controller = require("./subscription.controller");
const { requireAuth } = require("../../middlewares/auth");

router.use(...requireAuth(["SSDI_SUPER_ADMIN"]));

router.get("/", controller.listSubscriptions);

module.exports = router;