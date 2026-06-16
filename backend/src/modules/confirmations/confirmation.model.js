const mongoose = require("mongoose");

const confirmationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RepoCase",
      required: true,
      index: true,
    },
    requestNote: { type: String, trim: true, default: "" },
    /** ONLINE = traced in app then shared; OFFLINE = shared outside then logged in app */
    traceMode: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "ONLINE",
    },
    shareChannel: {
      type: String,
      enum: ["whatsapp", "email", "sms", "app", null],
      default: null,
    },
    photos: [{ type: String, trim: true }],
    inventoryImages: [{ type: String, trim: true }],
    inventoryVideos: [{ type: String, trim: true }],
    inventoryPdfs: [{ type: String, trim: true }],
    inventorySubmittedAt: { type: Date, default: null },
    inventorySubmittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    inventoryRevisionRequested: { type: Boolean, default: false },
    inventoryRevisionNote: { type: String, trim: true, default: "" },
    inventoryRevisionRequestedAt: { type: Date, default: null },
    /** Set when repo admin approves tracer inventory upload */
    inventoryConfirmedAt: { type: Date, default: null },
    inventoryConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByName: { type: String, trim: true },
    requestedByRole: { type: String, trim: true },
    requestedByPhone: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    finalAction: {
      type: String,
      enum: ["IN_YARD", "RELEASE", "REJECT", "CONFIRM", null],
      default: null,
    },
    reviewNote: { type: String, trim: true, default: "" },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Confirmation", confirmationSchema);
