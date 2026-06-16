const mongoose = require("mongoose");

/**
 * DataUsageLog — written when a Repo Admin assigns a BankRecord to a Tracer.
 * This powers the banker's tracing view: who is using my data, and who is the tracer.
 */
const dataUsageLogSchema = new mongoose.Schema(
  {
    bankRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BankRecord",
      required: true,
      index: true,
    },

    /** Denormalized for fast banker-level queries */
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },

    /** Repo Admin who assigned the record */
    repoAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /** Tracer / User who is working the record */
    tracerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "returned", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

dataUsageLogSchema.index({ uploadedBy: 1, status: 1 });
dataUsageLogSchema.index({ bankId: 1, repoAdminId: 1 });

module.exports = mongoose.model("DataUsageLog", dataUsageLogSchema);
