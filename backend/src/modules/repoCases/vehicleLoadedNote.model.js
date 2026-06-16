const mongoose = require("mongoose");

const vehicleLoadedNoteSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    /** Normalized vehicle or chassis used as lookup key when no Mongo case exists. */
    lookupKey: { type: String, required: true, trim: true, uppercase: true, index: true },
    vehicleNumber: { type: String, trim: true, uppercase: true, default: "" },
    chassisNumber: { type: String, trim: true, uppercase: true, default: "" },
    loadedShort: { type: String, trim: true, maxlength: 120, default: "" },
    loadedDetail: { type: String, trim: true, maxlength: 2000, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByName: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

vehicleLoadedNoteSchema.index({ companyId: 1, lookupKey: 1 }, { unique: true });

module.exports = mongoose.model("VehicleLoadedNote", vehicleLoadedNoteSchema);
