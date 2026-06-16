const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true },

    provider: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY" },

    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    amount: { type: Number, required: true, min: 0 }, // INR rupees
    currency: { type: String, default: "INR" },

    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
    paidAt: { type: Date, default: null },

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
