const AuditLog = require("./auditLog.model");

async function listAuditLogs(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const filter = {};

    if (req.user.role !== "SSDI_SUPER_ADMIN") {
      filter.companyId = req.user.companyId;
    } else if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }

    if (req.query.action) {
      filter.action = req.query.action;
    }

    const total = await AuditLog.countDocuments(filter);
    const items = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: { page, limit, total, items },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { listAuditLogs };
