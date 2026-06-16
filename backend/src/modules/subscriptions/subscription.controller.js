const Subscription = require("./subscription.model");
const { ok } = require("../../utils/response");

module.exports.listSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate("companyId")
      .populate("planId")
      .sort({ createdAt: -1 });

    return ok(res, subscriptions, "Subscriptions fetched successfully");
  } catch (e) {
    next(e);
  }
};