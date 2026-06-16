const Razorpay = require("razorpay");
const crypto = require("crypto");
const { z } = require("zod");

const Subscription = require("../subscriptions/subscription.model");
const Plan = require("../plans/plan.model");
const Payment = require("./payment.model");
const { ok } = require("../../utils/response");

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys are missing in environment variables.");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

module.exports.createOrder = async (req, res, next) => {
  try {
    const schema = z.object({
      subscriptionId: z.string().min(1),
    });

    const { subscriptionId } = schema.parse(req.body);
    const razorpay = getRazorpayClient();

    const sub = await Subscription.findById(subscriptionId).populate("planId");
    if (!sub) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const plan = sub.planId?._id ? sub.planId : await Plan.findById(sub.planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan missing",
      });
    }

    const amountRupees = Number(plan.price || 0);
    if (amountRupees <= 0) {
      return res.status(400).json({
        success: false,
        message: "Plan price is 0. Update plan price first.",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountRupees * 100),
      currency: plan.currency || "INR",
      receipt: `sub_${sub._id}`,
      notes: {
        subscriptionId: String(sub._id),
        companyId: String(sub.companyId),
      },
    });

    const payment = await Payment.create({
      companyId: sub.companyId,
      subscriptionId: sub._id,
      amount: amountRupees,
      currency: plan.currency || "INR",
      status: "PENDING",
      razorpayOrderId: order.id,
      meta: { order, paymentType: "MONTHLY_SUBSCRIPTION" },
    });

    return ok(
      res,
      {
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
      },
      "Order created"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.verifyPayment = async (req, res, next) => {
  try {
    const schema = z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
      paymentId: z.string().min(1),
    });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
    } = schema.parse(req.body);

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    payment.razorpayOrderId = razorpay_order_id;
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;

    if (expectedSignature !== razorpay_signature) {
      payment.status = "FAILED";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    payment.status = "SUCCESS";
    payment.paidAt = new Date();
    await payment.save();

    const subscription = await Subscription.findById(payment.subscriptionId).populate("planId");

    const paymentType = payment.meta?.paymentType || "MONTHLY_SUBSCRIPTION";

    if (subscription && paymentType === "MONTHLY_SUBSCRIPTION") {
      const plan = subscription.planId?._id
        ? subscription.planId
        : await Plan.findById(subscription.planId);

      const durationMonths = Number(plan?.durationMonths || 1);
      const startDate = new Date();
      const endDate = addMonths(startDate, durationMonths);

      subscription.status = "ACTIVE";
      subscription.paymentStatus = "PAID";
      subscription.schemeBlocked = false;
      subscription.blockedReason = null;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();
    }

    return ok(
      res,
      {
        paymentId: payment._id,
        status: payment.status,
      },
      "Payment verified successfully"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.createConnectFeeOrder = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { getConnectEligibility } = require("../../utils/subscriptionLimits");
    const { getTierConfig } = require("../../constants/subscriptionTiers");

    const eligibility = await getConnectEligibility(companyId);
    if (!eligibility.allowed) {
      return res.status(403).json({
        success: false,
        message: eligibility.reason,
        code: eligibility.code,
      });
    }

    if (!eligibility.requiresConnectFee) {
      return res.status(400).json({
        success: false,
        message: "Your current plan does not require a per-user connect fee.",
      });
    }

    let sub = await Subscription.findOne({ companyId }).sort({ createdAt: -1 });
    if (!sub) {
      const freePlan = await Plan.findOne({ tierId: "free", isActive: true });
      if (!freePlan) {
        return res.status(400).json({
          success: false,
          message: "No subscription plan configured. Contact SSDI admin.",
        });
      }
      const startDate = new Date();
      sub = await Subscription.create({
        companyId,
        planId: freePlan._id,
        tierId: "free",
        startDate,
        endDate: addMonths(startDate, 1),
        status: "ACTIVE",
        paymentStatus: "PAID",
      });
    }

    const amountRupees = eligibility.connectFeeAmount;
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt: `connect_${sub._id}_${Date.now()}`,
      notes: {
        subscriptionId: String(sub._id),
        companyId: String(companyId),
        paymentType: "USER_CONNECT_FEE",
      },
    });

    const payment = await Payment.create({
      companyId,
      subscriptionId: sub._id,
      amount: amountRupees,
      currency: "INR",
      status: "PENDING",
      razorpayOrderId: order.id,
      meta: {
        order,
        paymentType: "USER_CONNECT_FEE",
        consumed: false,
        tierId: eligibility.tierId,
      },
    });

    return ok(
      res,
      {
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
        connectFeeAmount: amountRupees,
        tierName: getTierConfig(eligibility.tierId).name,
      },
      "Connect fee order created"
    );
  } catch (e) {
    next(e);
  }
};