const FinanceEntry = require("./financeEntry.model");

const createFinanceEntry = async (req, res) => {
  try {
    const { caseId, type, amount, description, entryDate } = req.body;

    const doc = await FinanceEntry.create({
      companyId: req.user.companyId,
      caseId: caseId || null,
      type,
      amount,
      description,
      entryDate: entryDate || new Date(),
      createdBy: req.user.userId,
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getFinanceEntries = async (req, res) => {
  try {
    const { type, caseId } = req.query;
    const query = { companyId: req.user.companyId };

    if (type) query.type = type;
    if (caseId) query.caseId = caseId;

    const docs = await FinanceEntry.find(query)
      .populate("caseId", "caseCode customerName vehicleNumber")
      .populate("createdBy", "name email")
      .sort({ entryDate: -1 });

    return res.json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getFinanceSummary = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const summary = await FinanceEntry.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await FinanceEntry.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      success: true,
      data: {
        byType: summary,
        overall: total[0] || { totalAmount: 0, count: 0 },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createFinanceEntry,
  getFinanceEntries,
  getFinanceSummary,
};