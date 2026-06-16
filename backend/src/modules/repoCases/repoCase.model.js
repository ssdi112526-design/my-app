const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    addedByName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const repoCaseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    caseCode: { type: String, required: true, trim: true, unique: true },
    referenceNumber: { type: String, trim: true },
    loanAccountNumber: { type: String, trim: true, index: true },

    bankName: { type: String, trim: true, index: true },
    branchName: { type: String, trim: true },
    uploadBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadBatch",
      default: null,
      index: true,
    },

    customerName: { type: String, required: true, trim: true, index: true },
    fatherName: { type: String, trim: true },
    mobileNumber: { type: String, trim: true, index: true },
    alternateMobileNumber: { type: String, trim: true },

    vehicleNumber: { type: String, trim: true, uppercase: true, index: true },
    chassisNumber: { type: String, trim: true, uppercase: true, index: true },
    engineNumber: { type: String, trim: true, uppercase: true, index: true },
    vehicleType: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleBrand: { type: String, trim: true },
    registrationState: { type: String, trim: true },

    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true, index: true },
    pincode: { type: String, trim: true },

    emiAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    totalOutstandingAmount: { type: Number, default: 0 },

    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    bucket: { type: String, trim: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
    repoStatus: {
      type: String,
      enum: ["NEW", "IN_PROGRESS", "FOLLOW_UP", "PENDING_CONFIRMATION", "RESOLVED", "REPOSSESSED", "CLOSED", "CANCELLED"],
      default: "NEW",
      index: true,
    },

    otpStatus: {
      type: String,
      enum: ["NOT_SENT", "SENT", "VERIFIED", "FAILED"],
      default: "NOT_SENT",
      index: true,
    },

    blacklistStatus: {
      type: String,
      enum: ["NO", "YES"],
      default: "NO",
      index: true,
    },

    confirmationStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    lastActionAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null },

    remarks: [remarkSchema],
    fieldNotes: { type: String, trim: true },
    /** Manual entry: what is loaded on the vehicle (short label). */
    loadedShort: { type: String, trim: true, maxlength: 120, default: "" },
    /** Manual entry: full description of loaded goods / cargo. */
    loadedDetail: { type: String, trim: true, maxlength: 2000, default: "" },

    /** Original Excel column values (header → value) for LRMS-style confirmation view */
    excelFields: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    /** Bank confirmation contacts from Excel (for notify messages & recipient lookup) */
    contactPerson1Name: { type: String, trim: true, default: "" },
    contactPerson1Phone: { type: String, trim: true, default: "" },
    contactPerson2Name: { type: String, trim: true, default: "" },
    contactPerson2Phone: { type: String, trim: true, default: "" },
    contactPerson3Name: { type: String, trim: true, default: "" },
    contactPerson3Phone: { type: String, trim: true, default: "" },
    bankNotifyEmail1: { type: String, trim: true, default: "" },
    bankNotifyEmail2: { type: String, trim: true, default: "" },

    /** Field tracer status (spec-aligned; independent of repoStatus) */
    traceStatus: {
      type: String,
      enum: [
        "PENDING",
        "TRACING",
        "TRACED",
        "NOT_FOUND",
        "WRONG_ADDRESS",
        "CUSTOMER_SHIFTED",
        "VEHICLE_PARKED",
        "REPOSSESSED",
        "CLOSED",
        "LEGAL_HOLD",
      ],
      default: "PENDING",
      index: true,
    },

    lastKnownLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      tracerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      tracerName: { type: String, trim: true, default: "" },
    },

    caseTimeline: [
      {
        type: { type: String, trim: true },
        summary: { type: String, trim: true },
        traceStatus: { type: String, trim: true },
        previousTraceStatus: { type: String, trim: true },
        byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byName: { type: String, trim: true },
        at: { type: Date, default: Date.now },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

repoCaseSchema.index({ companyId: 1, vehicleNumber: 1 });
repoCaseSchema.index({ companyId: 1, uploadBatchId: 1 });
repoCaseSchema.index({ companyId: 1, loanAccountNumber: 1 });
repoCaseSchema.index({ companyId: 1, repoStatus: 1 });
repoCaseSchema.index({ companyId: 1, customerName: 1 });

module.exports = mongoose.model("RepoCase", repoCaseSchema);