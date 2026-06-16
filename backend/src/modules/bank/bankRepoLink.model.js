const mongoose = require("mongoose");

/**
 * BankRepoLink — links a specific Banker (BANK_ADMIN or BANK_PERSON)
 * to a Repo Admin / Agency.
 *
 * The agency can see ONLY BankRecords where uploadedBy = bankPersonId
 * of their linked rows.
 *
 * One agency can have links to multiple bankers (from different banks).
 * One banker can link to multiple agencies.
 */
const bankRepoLinkSchema = new mongoose.Schema(
  {
    /** The specific banker (BANK_ADMIN or BANK_PERSON) who referred */
    bankPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** Denormalized for bank-level queries */
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },

    /** The Repo Admin / Agency being connected */
    repoAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** SSDI user who created this link */
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent duplicate links for same banker ↔ repo admin pair
bankRepoLinkSchema.index({ bankPersonId: 1, repoAdminId: 1 }, { unique: true });

module.exports = mongoose.model("BankRepoLink", bankRepoLinkSchema);
