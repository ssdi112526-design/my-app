const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "" },
    action: { type: String, required: true, trim: true, index: true },
    entity: { type: String, trim: true, default: "" },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
