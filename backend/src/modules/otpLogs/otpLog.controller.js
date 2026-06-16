const OtpLog = require("./otpLog.model");
const RepoCase = require("../repoCases/repoCase.model");

const createOtpLog = async (req, res) => {
  try {
    const { caseId, mobileNumber, otpCode, provider, remarks } = req.body;

    const repoCase = await RepoCase.findOne({
      _id: caseId,
      companyId: req.user.companyId,
    });

    if (!repoCase) {
      return res.status(404).json({ success: false, message: "Case not found." });
    }

    const log = await OtpLog.create({
      companyId: req.user.companyId,
      caseId,
      mobileNumber,
      otpCode,
      provider: provider || "MANUAL",
      remarks,
      createdBy: req.user.userId,
    });

    repoCase.otpStatus = "SENT";
    repoCase.updatedBy = req.user.userId;
    await repoCase.save();

    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOtpLogs = async (req, res) => {
  try {
    const { status, caseId } = req.query;

    const query = { companyId: req.user.companyId };
    if (status) query.status = status;
    if (caseId) query.caseId = caseId;

    const logs = await OtpLog.find(query)
      .populate("caseId", "caseCode customerName vehicleNumber")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const verifyOtpLog = async (req, res) => {
  try {
    const { status } = req.body;

    const log = await OtpLog.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!log) {
      return res.status(404).json({ success: false, message: "OTP log not found." });
    }

    log.status = status;
    if (status === "VERIFIED") {
      log.verifiedAt = new Date();
    }
    await log.save();

    const repoCase = await RepoCase.findById(log.caseId);
    if (repoCase) {
      repoCase.otpStatus = status === "VERIFIED" ? "VERIFIED" : "FAILED";
      repoCase.updatedBy = req.user.userId;
      await repoCase.save();
    }

    return res.json({ success: true, data: log });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOtpLog,
  getOtpLogs,
  verifyOtpLog,
};