const mongoose = require("mongoose");

const blacklistSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "RepoCase", required: true, index: true },
    vehicleNumber: { type: String, trim: true, uppercase: true, index: true },
    chassisNumber: { type: String, trim: true, uppercase: true },
    customerName: { type: String, trim: true },
    reason: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "REMOVED"], default: "ACTIVE", index: true },
    blacklistedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blacklistedAt: { type: Date, default: Date.now },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlacklistEntry", blacklistSchema);