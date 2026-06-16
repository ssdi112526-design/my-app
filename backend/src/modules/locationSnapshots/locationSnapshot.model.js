const mongoose = require("mongoose");

const locationSnapshotSchema = new mongoose.Schema(
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
    tracerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tracerName: { type: String, trim: true, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
    source: { type: String, enum: ["GPS", "MANUAL"], default: "GPS" },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

locationSnapshotSchema.index({ caseId: 1, createdAt: -1 });

module.exports = mongoose.model("LocationSnapshot", locationSnapshotSchema);
