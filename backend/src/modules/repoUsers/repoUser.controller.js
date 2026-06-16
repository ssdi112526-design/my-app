const mongoose = require("mongoose");
const User = require("../users/user.model");
const UserPhoneOtp = require("./userPhoneOtp.model");
const RepoCase = require("../repoCases/repoCase.model");
const { hashPassword } = require("../../utils/hash");
const {
  ASSIGNABLE_REPO_ROLES,
  COMPANY_USER_ROLES,
  MANAGEABLE_REPO_ROLES,
} = require("../../constants/repoRoles");
const { BLOOD_GROUPS } = require("../../constants/userProfile");
const {
  OTP_TTL_MS,
  VERIFIED_TTL_MS,
  DEV_FIXED_OTP,
  normalizePhone,
  getOtpCodeForSend,
  isDevFixedOtp,
  hashOtp,
  verifyOtpHash,
} = require("./phoneOtp.util");
const {
  assertCanConnectUser,
  consumeConnectPayment,
  getConnectEligibility,
  skipPaymentLimits,
} = require("../../utils/subscriptionLimits");
const { sendExcelDownload, formatDate } = require("../../utils/excelExport");
const { formatRepoRole } = require("../../utils/repoRoleLabels");

const EXPORT_LIMIT = 5000;

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getAssignedUserIdsMatchingVehicleNumber(companyId, qRaw) {
  const q = String(qRaw || "").trim();
  if (!q || !mongoose.Types.ObjectId.isValid(String(companyId))) return [];

  const safe = escapeRegex(q);
  const companyObjectId =
    companyId instanceof mongoose.Types.ObjectId
      ? companyId
      : new mongoose.Types.ObjectId(String(companyId));

  const ids = await RepoCase.distinct("assignedToUserId", {
    companyId: companyObjectId,
    assignedToUserId: { $ne: null },
    vehicleNumber: { $regex: safe, $options: "i" },
  });
  return ids.filter(Boolean);
}

/** Distinct assigned vehicle plates per user (RepoCase.assignedToUserId). */
async function getAssignedVehicleNumbersByUserIds(companyId, userIds) {
  const map = new Map();
  if (!Array.isArray(userIds) || !userIds.length) return map;
  const companyObjectId =
    companyId instanceof mongoose.Types.ObjectId
      ? companyId
      : new mongoose.Types.ObjectId(String(companyId));

  const rows = await RepoCase.aggregate([
    {
      $match: {
        companyId: companyObjectId,
        assignedToUserId: { $in: userIds },
        vehicleNumber: { $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: "$assignedToUserId",
        plates: { $addToSet: "$vehicleNumber" },
      },
    },
  ]);

  rows.forEach((r) => {
    const plates = (r.plates || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
    map.set(String(r._id), plates);
  });

  return map;
}

async function buildRepoUserFilter(companyId, query = {}) {
  const q = (query.q || "").trim();
  const filter = {
    companyId,
    role: { $in: COMPANY_USER_ROLES },
  };

  if (q) {
    const vehicleUserIds = await getAssignedUserIdsMatchingVehicleNumber(companyId, q);
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { fatherName: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
      { address: { $regex: q, $options: "i" } },
      { city: { $regex: q, $options: "i" } },
      { pincode: { $regex: q, $options: "i" } },
      { state: { $regex: q, $options: "i" } },
      { bloodGroup: { $regex: q, $options: "i" } },
      { role: { $regex: q, $options: "i" } },
      ...(vehicleUserIds.length ? [{ _id: { $in: vehicleUserIds } }] : []),
    ];
  }

  return filter;
}

async function assertPhoneVerified(phone, companyId) {
  const verified = await UserPhoneOtp.findOne({
    phone,
    companyId,
    status: "VERIFIED",
    verifiedAt: { $gte: new Date(Date.now() - VERIFIED_TTL_MS) },
  }).sort({ verifiedAt: -1 });

  return Boolean(verified);
}

const sendUserPhoneOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Valid mobile number is required (at least 10 digits).",
      });
    }

    const otpCode = getOtpCodeForSend();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await UserPhoneOtp.updateMany(
      { phone, companyId: req.user.companyId, status: "PENDING" },
      { status: "EXPIRED" }
    );

    await UserPhoneOtp.create({
      phone,
      companyId: req.user.companyId,
      otpHash: hashOtp(otpCode),
      expiresAt,
      status: "PENDING",
      createdBy: req.user.userId,
    });

    console.log(`[OTP] User create — use OTP ${DEV_FIXED_OTP} for ${phone}`);

    return res.json({
      success: true,
      message: `Use OTP ${DEV_FIXED_OTP} (test mode — SMS not sent).`,
      data: {
        phone,
        devOtp: DEV_FIXED_OTP,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const verifyUserPhoneOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required.",
      });
    }

    const otpTrimmed = String(otp).trim();
    const companyId = req.user.companyId;

    if (isDevFixedOtp(otpTrimmed)) {
      await UserPhoneOtp.updateMany(
        { phone, companyId, status: "PENDING" },
        { status: "EXPIRED" }
      );
      await UserPhoneOtp.create({
        phone,
        companyId,
        otpHash: hashOtp(DEV_FIXED_OTP),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        status: "VERIFIED",
        verifiedAt: new Date(),
        createdBy: req.user.userId,
      });
    } else {
      const record = await UserPhoneOtp.findOne({
        phone,
        companyId,
        status: "PENDING",
      }).sort({ createdAt: -1 });

      if (!record) {
        return res.status(400).json({
          success: false,
          message: "No OTP found. Please send OTP again.",
        });
      }

      if (record.expiresAt < new Date()) {
        record.status = "EXPIRED";
        await record.save();
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please send a new OTP.",
        });
      }

      if (!verifyOtpHash(otpTrimmed, record.otpHash)) {
        return res.status(400).json({
          success: false,
          message: `Invalid OTP. Use ${DEV_FIXED_OTP} in test mode.`,
        });
      }

      record.status = "VERIFIED";
      record.verifiedAt = new Date();
      await record.save();
    }

    return res.json({
      success: true,
      message: "Mobile number verified successfully.",
      data: { phone, verified: true },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getConnectEligibilityHandler = async (req, res) => {
  try {
    const data = await getConnectEligibility(req.user.companyId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createRepoUser = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      name,
      email,
      phone,
      password,
      role,
      fatherName,
      address,
      city,
      pincode,
      state,
      bloodGroup,
      dateOfBirth,
      connectPaymentId,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and role are required.",
      });
    }

    if (!fatherName || !String(fatherName).trim()) {
      return res.status(400).json({
        success: false,
        message: "Father name is required.",
      });
    }

    if (!address || !String(address).trim()) {
      return res.status(400).json({
        success: false,
        message: "Address is required.",
      });
    }

    if (!city || !String(city).trim()) {
      return res.status(400).json({
        success: false,
        message: "City is required.",
      });
    }

    if (!pincode || !String(pincode).trim()) {
      return res.status(400).json({
        success: false,
        message: "Pincode is required.",
      });
    }

    if (!state || !String(state).trim()) {
      return res.status(400).json({
        success: false,
        message: "State is required.",
      });
    }

    if (!bloodGroup || !BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: "Valid blood group is required.",
      });
    }

    const normalizedDob = String(dateOfBirth || "").trim();
    if (!normalizedDob || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDob)) {
      return res.status(400).json({
        success: false,
        message: "Valid date of birth is required (DD / MM / YYYY).",
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Valid mobile number is required.",
      });
    }

    let phoneOk = await assertPhoneVerified(normalizedPhone, companyId);
    if (!phoneOk && skipPaymentLimits()) {
      await UserPhoneOtp.create({
        phone: normalizedPhone,
        companyId,
        otpHash: hashOtp(DEV_FIXED_OTP),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        status: "VERIFIED",
        verifiedAt: new Date(),
        createdBy: req.user.userId,
      });
      phoneOk = true;
    }
    if (!phoneOk) {
      return res.status(400).json({
        success: false,
        message: "Please verify the mobile number with OTP before creating the user.",
      });
    }

    if (!ASSIGNABLE_REPO_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already exists.",
      });
    }

    let connectPayment = null;
    try {
      const check = await assertCanConnectUser(companyId, { connectPaymentId });
      connectPayment = check.connectPayment || null;
    } catch (limitError) {
      return res.status(limitError.statusCode || 403).json({
        success: false,
        message: limitError.message,
        code: limitError.code || null,
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      fatherName: String(fatherName).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      pincode: String(pincode).trim(),
      state: String(state).trim(),
      bloodGroup,
      dateOfBirth: normalizedDob,
      passwordHash,
      role,
      companyId,
      isActive: true,
      registrationSource: "ADMIN",
    });

    await UserPhoneOtp.deleteMany({
      phone: normalizedPhone,
      companyId,
      status: "VERIFIED",
    });

    await consumeConnectPayment(connectPayment, user._id);

    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getRepoUsers = async (req, res) => {
  try {
    const filter = await buildRepoUserFilter(req.user.companyId, req.query);

    const users = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u._id);
    const vehicleMap = await getAssignedVehicleNumbersByUserIds(req.user.companyId, userIds);
    const data = users.map((u) => ({
      ...u,
      assignedVehicleNumbers: vehicleMap.get(String(u._id)) || [],
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getRepoUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      role: { $in: COMPANY_USER_ROLES },
    }).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateRepoUser = async (req, res) => {
  try {
    const {
      name,
      phone,
      role,
      isActive,
      fatherName,
      address,
      city,
      pincode,
      state,
      bloodGroup,
    } = req.body;

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      role: { $in: MANAGEABLE_REPO_ROLES },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (role && !ASSIGNABLE_REPO_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) {
      user.phone = normalizePhone(phone) || String(phone).trim();
    }
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (pincode !== undefined) user.pincode = pincode;
    if (state !== undefined) user.state = state;
    if (bloodGroup !== undefined) {
      if (!BLOOD_GROUPS.includes(bloodGroup)) {
        return res.status(400).json({
          success: false,
          message: "Invalid blood group.",
        });
      }
      user.bloodGroup = bloodGroup;
    }
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changeRepoUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      role: { $in: MANAGEABLE_REPO_ROLES },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.isActive = Boolean(isActive);
    await user.save();

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const resetRepoUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      role: { $in: ["REPO_STAFF", "REPO_VIEWER", "REPO_ADMIN"] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    return res.json({ success: true, message: "Password reset successful." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const exportRepoUsers = async (req, res) => {
  try {
    const filter = await buildRepoUserFilter(req.user.companyId, req.query);

    const users = await User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT)
      .lean();

    const userIds = users.map((u) => u._id);
    const vehicleMap = await getAssignedVehicleNumbersByUserIds(req.user.companyId, userIds);

    const rows = users.map((user, index) => ({
      "S.No.": index + 1,
      Name: user.name || "",
      "Father's Name": user.fatherName || "",
      Email: user.email || "",
      Phone: user.phone || "",
      "Assigned vehicle numbers": (vehicleMap.get(String(user._id)) || []).join(", "),
      Role: formatRepoRole(user.role),
      Status: user.isActive ? "Active" : "Inactive",
      Address: user.address || "",
      City: user.city || "",
      State: user.state || "",
      Pincode: user.pincode || "",
      "Blood Group": user.bloodGroup || "",
      "Last Login": formatDate(user.lastLoginAt),
      "Created Date": formatDate(user.createdAt),
    }));

    const filename = `fastrecovery-users-${formatDate(new Date())}.xlsx`;
    return sendExcelDownload(res, filename, rows, "Users");
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  sendUserPhoneOtp,
  verifyUserPhoneOtp,
  getConnectEligibilityHandler,
  createRepoUser,
  getRepoUsers,
  exportRepoUsers,
  getRepoUserById,
  updateRepoUser,
  changeRepoUserStatus,
  resetRepoUserPassword,
};