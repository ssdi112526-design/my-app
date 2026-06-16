const mongoose = require("mongoose");

/**
 * Reject reserved path segments and invalid MongoDB ids before findById.
 */
function validateObjectId(paramName = "id") {
  const reserved = new Set([
    "export",
    "stats",
    "next-code",
    "download-excel",
    "repo-admin-phone",
  ]);

  return (req, res, next) => {
    const value = String(req.params[paramName] || "");

    if (reserved.has(value)) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        success: false,
        message: "Invalid id",
      });
    }

    next();
  };
}

module.exports = { validateObjectId };
