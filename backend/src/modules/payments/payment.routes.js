const router = require("express").Router();
const controller = require("./payment.controller");
const { requireAuth } = require("../../middlewares/auth");

router.use(...requireAuth(["SSDI_SUPER_ADMIN"]));

router.post("/create-order", controller.createOrder);
router.post("/verify", controller.verifyPayment);

module.exports = router;