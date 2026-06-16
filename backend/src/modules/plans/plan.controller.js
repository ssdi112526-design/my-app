const { z } = require("zod");
const Plan = require("./plan.model");
const { ok } = require("../../utils/response");
const { SUBSCRIPTION_TIERS } = require("../../constants/subscriptionTiers");

const TIER_SEED = [
  {
    name: "Free",
    tierId: "free",
    billingType: "PER_CONNECT",
    durationMonths: 1,
    price: 0,
    monthlyPrice: 0,
    perConnectFee: 150,
    maxUsers: null,
  },
  {
    name: "Silver",
    tierId: "silver",
    billingType: "MONTHLY_FLAT",
    durationMonths: 1,
    price: 5000,
    monthlyPrice: 5000,
    perConnectFee: 0,
    maxUsers: 50,
  },
  {
    name: "Golden",
    tierId: "golden",
    billingType: "MONTHLY_FLAT",
    durationMonths: 1,
    price: 15000,
    monthlyPrice: 15000,
    perConnectFee: 0,
    maxUsers: 100,
  },
  {
    name: "Platinum",
    tierId: "platinum",
    billingType: "CUSTOM",
    durationMonths: 1,
    price: 0,
    monthlyPrice: 0,
    perConnectFee: 0,
    maxUsers: null,
  },
];

module.exports.seedDefaultPlans = async (req, res, next) => {
  try {
    for (const p of TIER_SEED) {
      const exists = await Plan.findOne({ tierId: p.tierId });
      if (!exists) {
        await Plan.create(p);
      } else {
        Object.assign(exists, p);
        await exists.save();
      }
    }

    const plans = await Plan.find({ tierId: { $ne: null } }).sort({ monthlyPrice: 1 });

    return ok(res, { plans }, "Subscription tier plans seeded");
  } catch (e) {
    next(e);
  }
};

module.exports.listTierPlans = async (req, res, next) => {
  try {
    let plans = await Plan.find({ tierId: { $ne: null }, isActive: true }).sort({
      monthlyPrice: 1,
    });

    if (!plans.length) {
      for (const p of TIER_SEED) {
        const exists = await Plan.findOne({ tierId: p.tierId });
        if (!exists) await Plan.create(p);
      }
      plans = await Plan.find({ tierId: { $ne: null }, isActive: true }).sort({
        monthlyPrice: 1,
      });
    }

    const tiers = plans.map((plan) => {
      const config = SUBSCRIPTION_TIERS[plan.tierId] || {};
      return {
        ...plan.toObject(),
        ...config,
      };
    });

    return ok(res, { plans, tiers }, "Tier plans");
  } catch (e) {
    next(e);
  }
};

module.exports.listPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find().sort({ durationMonths: 1 });
    return ok(res, { plans }, "Plans");
  } catch (e) {
    next(e);
  }
};

const updateSchema = z.object({
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).optional(),
});

module.exports.updatePlan = async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    Object.assign(plan, body);
    await plan.save();

    return ok(res, { plan }, "Plan updated");
  } catch (e) {
    next(e);
  }
};