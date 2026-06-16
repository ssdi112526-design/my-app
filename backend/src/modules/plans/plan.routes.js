const router = require("express").Router();
const controller = require("./plan.controller");
const { requireAuth } = require("../../middlewares/auth");

router.get("/tiers", controller.listTierPlans);

router.use(requireAuth(["SSDI_SUPER_ADMIN"]));

router.post("/seed", controller.seedDefaultPlans);
router.get("/", controller.listPlans);
router.put("/:id", controller.updatePlan);

module.exports = router;