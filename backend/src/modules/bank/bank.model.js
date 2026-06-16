const mongoose = require("mongoose");

/**
 * Bank — the top-level entity created by SSDI or via self-registration.
 * A Bank has one BANK_ADMIN user (stored in User collection with bankId).
 */
const bankSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    bankCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    gstNumber: { type: String, trim: true, default: "" },
    panNumber: { type: String, trim: true, default: "" },
    branchName: { type: String, trim: true, default: "" },

    /** The User document that is the BANK_ADMIN for this bank */
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * pending_payment → active (SSDI activates after payment)
     * expired          → SSDI or cron flips when payment lapses
     */
    status: {
      type: String,
      enum: ["pending_payment", "active", "expired", "inactive"],
      default: "pending_payment",
    },

    registrationSource: {
      type: String,
      enum: ["ADMIN", "SELF"],
      default: "SELF",
    },

    /** SSDI user who created or last changed this record */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    /** Payment tracking (no gateway yet — SSDI marks manually) */
    activatedAt: { type: Date, default: null },
    lastPaymentAt: { type: Date, default: null },
    nextDueAt: { type: Date, default: null },
    paymentNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bank", bankSchema);
