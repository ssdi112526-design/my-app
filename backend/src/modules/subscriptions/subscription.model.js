const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    tierId: {
      type: String,
      enum: ["free", "silver", "golden", "platinum"],
      default: "free",
    },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "CANCELLED", "PAST_DUE"], default: "ACTIVE" },
    paymentStatus: { type: String, enum: ["PAID", "UNPAID"], default: "UNPAID" },
    schemeBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, default: null },

    lastReminderSentAt: { type: Date, default: null },
    nextReminderAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
