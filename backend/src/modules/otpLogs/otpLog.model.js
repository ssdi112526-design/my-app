const mongoose = require("mongoose");

const otpLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "RepoCase", required: true, index: true },
    mobileNumber: { type: String, required: true, trim: true },
    otpCode: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    status: { type: String, enum: ["SENT", "VERIFIED", "FAILED", "EXPIRED"], default: "SENT", index: true },
    provider: { type: String, trim: true, default: "MANUAL" },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OtpLog", otpLogSchema);