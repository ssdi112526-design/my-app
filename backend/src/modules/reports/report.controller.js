const RepoCase = require("../repoCases/repoCase.model");
const OtpLog = require("../otpLogs/otpLog.model");
const BlacklistEntry = require("../blacklist/blacklist.model");
const Confirmation = require("../confirmations/confirmation.model");

const getStatusWiseReport = async (req, res) => {
  try {
    const data = await RepoCase.aggregate([
      { $match: { companyId: req.user.companyId } },
      { $group: { _id: "$repoStatus", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getUserWiseReport = async (req, res) => {
  try {
    const data = await RepoCase.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$assignedToUserId",
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBankWiseReport = async (req, res) => {
  try {
    const data = await RepoCase.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$bankName",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOtpReport = async (req, res) => {
  try {
    const data = await OtpLog.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBlacklistReport = async (req, res) => {
  try {
    const data = await BlacklistEntry.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getConfirmationReport = async (req, res) => {
  try {
    const data = await Confirmation.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStatusWiseReport,
  getUserWiseReport,
  getBankWiseReport,
  getOtpReport,
  getBlacklistReport,
  getConfirmationReport,
};