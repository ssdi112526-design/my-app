const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * PendingBankInvite — when an agency is not yet registered,
 * SSDI creates this invite. The agency registers via the token link,
 * and on success a BankRepoLink is auto-created.
 */
const pendingBankInviteSchema = new mongoose.Schema(
  {
    /** Banker who referred this agency */
    bankPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
    },

    agencyEmail: { type: String, trim: true, lowercase: true, default: "" },
    agencyName: { type: String, trim: true, default: "" },

    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingBankInvite", pendingBankInviteSchema);
