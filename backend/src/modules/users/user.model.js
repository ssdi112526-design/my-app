const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    fatherName: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    district: {
      type: String,
      trim: true,
      default: "",
    },

    post: {
      type: String,
      trim: true,
      default: "",
    },

    agencyName: {
      type: String,
      trim: true,
      default: "",
    },

    dateOfBirth: {
      type: String,
      trim: true,
      default: "",
    },

    photoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    bloodGroup: {
      type: String,
      trim: true,
      default: "",
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "SSDI_SUPER_ADMIN",
        "REPO_ADMIN",
        "TEAM_LEADER",
        "HEAD_OFFICE_STAFF",
        "OFFICE_STAFF",
        "REPO_STAFF",
        "REPO_VIEWER",
        "BANK_ADMIN",
        "BANK_PERSON",
      ],
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    /** Bank this user belongs to (BANK_ADMIN or BANK_PERSON only) */
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      default: null,
      index: true,
    },

    /** Branch / employee id for bank staff (BANK_ADMIN, BANK_PERSON) */
    branchName: { type: String, trim: true, default: "" },
    employeeNumber: { type: String, trim: true, default: "" },

    /** Team leader who supervises this field tracer (REPO_STAFF). */
    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    lastKnownLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      activeCaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RepoCase",
        default: null,
      },
      vehicleNumber: { type: String, trim: true, default: "" },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    registrationSource: {
      type: String,
      enum: ["ADMIN", "SELF"],
      default: "ADMIN",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);