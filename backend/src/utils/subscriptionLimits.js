const User = require("../modules/users/user.model");
const Subscription = require("../modules/subscriptions/subscription.model");
const Plan = require("../modules/plans/plan.model");
const { ASSIGNABLE_REPO_ROLES } = require("../constants/repoRoles");
const { getTierConfig } = require("../constants/subscriptionTiers");

/** Skip subscription payment / per-user connect fee until payments are implemented. */
function skipPaymentLimits() {
  if (process.env.SKIP_PAYMENT_CHECKS === "false") return false;
  if (process.env.SKIP_PAYMENT_CHECKS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

async function countConnectedUsers(companyId) {
  return User.countDocuments({
    companyId,
    role: { $in: ASSIGNABLE_REPO_ROLES },
    isActive: true,
  });
}

async function getCompanySubscription(companyId) {
  return Subscription.findOne({ companyId })
    .sort({ createdAt: -1 })
    .populate("planId");
}

function resolveTierId(subscription, plan) {
  if (subscription?.tierId) return subscription.tierId;
  if (plan?.tierId) return plan.tierId;
  return "free";
}

function isSubscriptionPeriodActive(subscription) {
  if (!subscription) return false;
  if (subscription.status !== "ACTIVE") return false;
  if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
    return false;
  }
  return true;
}

async function blockScheme(subscription, reason) {
  if (!subscription) return;
  subscription.schemeBlocked = true;
  subscription.blockedReason = reason;
  if (subscription.status === "ACTIVE") {
    subscription.status = "PAST_DUE";
  }
  await subscription.save();
}

async function getConnectEligibility(companyId) {
  const subscription = await getCompanySubscription(companyId);
  const plan = subscription?.planId?._id
    ? subscription.planId
    : subscription?.planId
      ? await Plan.findById(subscription.planId)
      : null;

  const tierId = resolveTierId(subscription, plan);
  const tier = getTierConfig(tierId);
  const connectedCount = await countConnectedUsers(companyId);
  const maxUsers = tier.maxUsers;
  const atUserLimit = maxUsers != null && connectedCount >= maxUsers;
  const schemeBlocked = Boolean(subscription?.schemeBlocked) || atUserLimit;

  const periodActive = isSubscriptionPeriodActive(subscription);
  const monthlyPaid =
    tier.billingType !== "MONTHLY_FLAT" ||
    (subscription?.paymentStatus === "PAID" && periodActive);

  let allowed = true;
  let reason = null;
  let code = null;

  if (schemeBlocked || atUserLimit) {
    allowed = false;
    code = "USER_LIMIT_REACHED";
    reason =
      maxUsers != null
        ? `Your ${tier.name} plan allows up to ${maxUsers} connected users. Upgrade your plan to add more users.`
        : "Your plan has reached its user limit. Please upgrade to continue.";
  } else if (
    !skipPaymentLimits() &&
    tier.billingType === "MONTHLY_FLAT" &&
    !monthlyPaid
  ) {
    allowed = false;
    code = "SUBSCRIPTION_UNPAID";
    reason = `Pay ₹${tier.monthlyPrice.toLocaleString("en-IN")}/month for the ${tier.name} plan before connecting new users.`;
  }

  const requiresConnectFee =
    !skipPaymentLimits() &&
    allowed &&
    tier.billingType === "PER_CONNECT" &&
    tier.perConnectFee > 0;

  return {
    tierId,
    tierName: tier.name,
    billingType: tier.billingType,
    connectedCount,
    maxUsers,
    remainingUsers: maxUsers != null ? Math.max(0, maxUsers - connectedCount) : null,
    monthlyPrice: tier.monthlyPrice,
    perConnectFee: tier.perConnectFee,
    schemeBlocked,
    allowed,
    reason,
    code,
    requiresConnectFee,
    connectFeeAmount: requiresConnectFee ? tier.perConnectFee : 0,
    paymentStatus: subscription?.paymentStatus || null,
  };
}

async function assertCanConnectUser(companyId, { connectPaymentId } = {}) {
  const eligibility = await getConnectEligibility(companyId);

  if (!eligibility.allowed) {
    const subscription = await getCompanySubscription(companyId);
    if (eligibility.code === "USER_LIMIT_REACHED" && subscription) {
      await blockScheme(subscription, eligibility.code);
    }

    const err = new Error(eligibility.reason);
    err.statusCode = 403;
    err.code = eligibility.code;
    throw err;
  }

  if (skipPaymentLimits() || !eligibility.requiresConnectFee) {
    return eligibility;
  }

  if (!connectPaymentId) {
    const err = new Error(
      `Pay ₹${eligibility.connectFeeAmount} one-time account creation fee before connecting this user.`
    );
    err.statusCode = 402;
    err.code = "CONNECT_FEE_REQUIRED";
    throw err;
  }

  const Payment = require("../modules/payments/payment.model");
  const payment = await Payment.findOne({
    _id: connectPaymentId,
    companyId,
    status: "SUCCESS",
    "meta.paymentType": "USER_CONNECT_FEE",
    "meta.consumed": { $ne: true },
  });

  if (!payment) {
    const err = new Error(
      "Valid connect-fee payment is required. Please complete payment and try again."
    );
    err.statusCode = 402;
    err.code = "CONNECT_FEE_INVALID";
    throw err;
  }

  return { ...eligibility, connectPayment: payment };
}

async function consumeConnectPayment(payment, userId) {
  if (!payment) return;
  payment.meta = {
    ...payment.meta,
    consumed: true,
    consumedAt: new Date(),
    consumedForUserId: String(userId),
  };
  await payment.save();
}

module.exports = {
  skipPaymentLimits,
  countConnectedUsers,
  getCompanySubscription,
  getConnectEligibility,
  assertCanConnectUser,
  consumeConnectPayment,
  blockScheme,
};
