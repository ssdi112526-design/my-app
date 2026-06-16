const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    companyCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPersonName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "PENDING"],
      default: "ACTIVE",
    },
    registrationSource: {
      type: String,
      enum: ["ADMIN", "SELF"],
      default: "ADMIN",
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "PAID",
    },
    paymentMethod: {
      type: String,
      enum: ["OFFLINE", "ONLINE"],
      default: null,
    },
    paymentNote: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMarkedAt: {
      type: Date,
      default: null,
    },
    blockReason: {
      type: String,
      trim: true,
      default: null,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    repoAdminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);