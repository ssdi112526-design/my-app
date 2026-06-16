const mongoose = require("mongoose");

const pendingRepoAdminPhoneOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true, index: true },
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
      index: true,
    },
  },
  { timestamps: true }
);

pendingRepoAdminPhoneOtpSchema.index({ phone: 1, createdBy: 1, status: 1 });

module.exports = mongoose.model(
  "PendingRepoAdminPhoneOtp",
  pendingRepoAdminPhoneOtpSchema
);
