const BlacklistEntry = require("./blacklist.model");
const RepoCase = require("../repoCases/repoCase.model");
const { sendExcelDownload, formatDate } = require("../../utils/excelExport");

const EXPORT_LIMIT = 5000;

const createBlacklistEntry = async (req, res) => {
  try {
    const { caseId, reason, remarks } = req.body;

    const repoCase = await RepoCase.findOne({
      _id: caseId,
      companyId: req.user.companyId,
    });

    if (!repoCase) {
      return res.status(404).json({ success: false, message: "Case not found." });
    }

    const entry = await BlacklistEntry.create({
      companyId: req.user.companyId,
      caseId,
      vehicleNumber: repoCase.vehicleNumber,
      chassisNumber: repoCase.chassisNumber,
      customerName: repoCase.customerName,
      reason,
      remarks,
      blacklistedBy: req.user.userId,
    });

    repoCase.blacklistStatus = "YES";
    repoCase.updatedBy = req.user.userId;
    await repoCase.save();

    return res.status(201).json({ success: true, data: entry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBlacklistEntries = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { companyId: req.user.companyId };
    if (status) query.status = status;

    const entries = await BlacklistEntry.find(query)
      .populate("caseId", "caseCode customerName vehicleNumber")
      .populate("blacklistedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: entries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const removeBlacklistEntry = async (req, res) => {
  try {
    const entry = await BlacklistEntry.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: "Blacklist entry not found." });
    }

    entry.status = "REMOVED";
    entry.removedBy = req.user.userId;
    entry.removedAt = new Date();
    await entry.save();

    const repoCase = await RepoCase.findById(entry.caseId);
    if (repoCase) {
      repoCase.blacklistStatus = "NO";
      repoCase.updatedBy = req.user.userId;
      await repoCase.save();
    }

    return res.json({ success: true, data: entry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listAllForSsdi = async (req, res) => {
  try {
    const { status = "ACTIVE", q } = req.query;
    const filter = {};

    if (status === "ACTIVE" || status === "REMOVED") {
      filter.status = status;
    }

    const entries = await BlacklistEntry.find(filter)
      .populate("companyId", "companyCode companyName email phone")
      .populate("caseId", "caseCode customerName vehicleNumber")
      .populate("blacklistedBy", "name email")
      .sort({ blacklistedAt: -1 })
      .limit(500);

    let data = entries;

    if (q && String(q).trim()) {
      const needle = String(q).trim().toLowerCase();
      data = entries.filter((entry) => {
        const company = entry.companyId || {};
        const caseRef = entry.caseId || {};
        return (
          String(entry.vehicleNumber || "").toLowerCase().includes(needle) ||
          String(entry.chassisNumber || "").toLowerCase().includes(needle) ||
          String(entry.customerName || "").toLowerCase().includes(needle) ||
          String(entry.reason || "").toLowerCase().includes(needle) ||
          String(company.companyName || "").toLowerCase().includes(needle) ||
          String(company.companyCode || "").toLowerCase().includes(needle) ||
          String(caseRef.caseCode || "").toLowerCase().includes(needle)
        );
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const removeBlacklistEntryBySsdi = async (req, res) => {
  try {
    const entry = await BlacklistEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ success: false, message: "Blacklist entry not found." });
    }

    if (entry.status === "REMOVED") {
      return res.json({ success: true, data: entry });
    }

    entry.status = "REMOVED";
    entry.removedBy = req.user.userId;
    entry.removedAt = new Date();
    await entry.save();

    const repoCase = await RepoCase.findById(entry.caseId);
    if (repoCase) {
      repoCase.blacklistStatus = "NO";
      repoCase.updatedBy = req.user.userId;
      await repoCase.save();
    }

    return res.json({ success: true, data: entry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const exportBlacklistEntries = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { companyId: req.user.companyId };
    if (status) query.status = status;

    const entries = await BlacklistEntry.find(query)
      .populate("caseId", "caseCode customerName vehicleNumber")
      .populate("blacklistedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT);

    const rows = entries.map((entry, index) => ({
      "S.No.": index + 1,
      "Case Code": entry.caseId?.caseCode || "",
      "Vehicle Number": entry.vehicleNumber || "",
      "Chassis Number": entry.chassisNumber || "",
      "Customer Name": entry.customerName || "",
      Reason: entry.reason || "",
      Remarks: entry.remarks || "",
      Status: entry.status || "",
      "Blacklisted By": entry.blacklistedBy?.name || entry.blacklistedBy?.email || "",
      "Blacklisted Date": formatDate(entry.blacklistedAt || entry.createdAt),
      "Removed Date": formatDate(entry.removedAt),
    }));

    const filename = `fastrecovery-blacklist-${formatDate(new Date())}.xlsx`;
    return sendExcelDownload(res, filename, rows, "Blacklist");
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createBlacklistEntry,
  getBlacklistEntries,
  exportBlacklistEntries,
  removeBlacklistEntry,
  listAllForSsdi,
  removeBlacklistEntryBySsdi,
};