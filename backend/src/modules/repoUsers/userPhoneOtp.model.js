const mongoose = require("mongoose");

const userPhoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true, index: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    verifiedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "EXPIRED"],
      default: "PENDING",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

userPhoneOtpSchema.index({ phone: 1, companyId: 1, status: 1 });

module.exports = mongoose.model("UserPhoneOtp", userPhoneOtpSchema);
