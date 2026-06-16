const mongoose = require("mongoose");
const CompanyBank = require("./companyBank.model");

const normalizeName = (value = "") => value.trim();
const normalizeCode = (value = "") => value.trim().toUpperCase();

const getCompanyBanks = async (req, res) => {
  try {
    const docs = await CompanyBank.find({
      companyId: req.user.companyId,
      isActive: true,
    }).sort({ bankName: 1 });

    return res.json({
      success: true,
      data: docs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createCompanyBank = async (req, res) => {
  try {
    const bankName = normalizeName(req.body.bankName);

    if (!bankName) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required.",
      });
    }

    const existing = await CompanyBank.findOne({
      companyId: req.user.companyId,
      bankName,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bank already exists for this company.",
      });
    }

    const doc = await CompanyBank.create({
      companyId: req.user.companyId,
      bankName,
      branches: [],
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const addBranchToBank = async (req, res) => {
  try {
    const { id } = req.params;
    const name = normalizeName(req.body.name);
    const code = normalizeCode(req.body.code);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Branch name is required.",
      });
    }

    const bank = await CompanyBank.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank not found.",
      });
    }

    const duplicate = bank.branches.find(
      (branch) => branch.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Branch already exists under this bank.",
      });
    }

    const notifyEmail = String(req.body.notifyEmail || "").trim();
    const notifyPhone = String(req.body.notifyPhone || "").trim();

    bank.branches.push({
      name,
      code,
      isActive: true,
      notifyEmail,
      notifyPhone,
    });
    bank.updatedBy = req.user.userId;

    await bank.save();

    return res.status(201).json({
      success: true,
      data: bank,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateBranchStatus = async (req, res) => {
  try {
    const { id, branchId } = req.params;
    const { isActive } = req.body;

    const bank = await CompanyBank.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank not found.",
      });
    }

    const branch = bank.branches.id(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    branch.isActive = Boolean(isActive);
    bank.updatedBy = req.user.userId;
    await bank.save();

    return res.json({
      success: true,
      data: bank,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateBranchContacts = async (req, res) => {
  try {
    const { id, branchId } = req.params;
    const notifyEmail = String(req.body.notifyEmail || "").trim();
    const notifyPhone = String(req.body.notifyPhone || "").trim();

    const bank = await CompanyBank.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank not found.",
      });
    }

    const branch = bank.branches.id(branchId);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found.",
      });
    }

    branch.notifyEmail = notifyEmail;
    branch.notifyPhone = notifyPhone;
    bank.updatedBy = req.user.userId;
    await bank.save();

    return res.json({
      success: true,
      data: bank,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateBankStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const bank = await CompanyBank.findOne({
      _id: id,
      companyId: req.user.companyId,
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank not found.",
      });
    }

    bank.isActive = Boolean(isActive);
    bank.updatedBy = req.user.userId;
    await bank.save();

    return res.json({
      success: true,
      data: bank,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getCompanyBanks,
  createCompanyBank,
  addBranchToBank,
  updateBranchContacts,
  updateBranchStatus,
  updateBankStatus,
};