const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tierId: {
      type: String,
      enum: ["free", "silver", "golden", "platinum"],
      default: null,
      sparse: true,
    },
    billingType: {
      type: String,
      enum: ["PER_CONNECT", "MONTHLY_FLAT", "CUSTOM"],
      default: "MONTHLY_FLAT",
    },
    durationMonths: { type: Number, required: true, enum: [1, 3, 6, 12] },
    price: { type: Number, required: true, min: 0 },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    perConnectFee: { type: Number, default: 0, min: 0 },
    maxUsers: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "INR" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);