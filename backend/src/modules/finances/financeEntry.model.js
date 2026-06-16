const mongoose = require("mongoose");

const financeEntrySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: "RepoCase", default: null, index: true },
    type: {
      type: String,
      enum: ["COLLECTION", "EXPENSE", "FUEL", "AGENT_PAYMENT", "INCENTIVE", "OTHER"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    entryDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FinanceEntry", financeEntrySchema);