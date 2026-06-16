const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    /** Legacy fields — kept for older records */
    subject: { type: String, trim: true, default: "" },
    category: {
      type: String,
      enum: ["BUG", "FEATURE_REQUEST", "SUPPORT", "GENERAL"],
      default: "GENERAL",
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_REVIEW", "RESOLVED"],
      default: "OPEN",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
