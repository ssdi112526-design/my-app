const { z } = require("zod");
const User = require("../users/user.model");
const Company = require("../companies/company.model");
const { comparePassword, hashPassword } = require("../../utils/hash");
const { signToken } = require("../../utils/jwt");
const { ok } = require("../../utils/response");
const { companySnapshot } = require("../../utils/companySnapshot");
const { normalizePhone } = require("../repoUsers/phoneOtp.util");
const {
  ASSIGNABLE_REPO_ROLES,
} = require("../../constants/repoRoles");
const {
  saveProfileImage,
  publicUploadUrl,
} = require("../../utils/profileImageStorage");

const REPO_STAFF_LOGIN_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const buildAuthResponse = async (user, token) => {
  let company = null;

  if (user.companyId) {
    const record = await Company.findById(user.companyId).select(
      "companyName companyCode status"
    );
    if (record && record.status === "ACTIVE") {
      company = companySnapshot(record);
    }
  }

  return {
    token,
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      companyId: user.companyId || null,
      company,
    },
  };
};

const loginUserByRoles = async ({ email, password, allowedRoles }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!user) {
    return {
      error: {
        status: 401,
        message: "Invalid credentials",
      },
    };
  }

  if (!user.isActive) {
    return {
      error: {
        status: 403,
        message:
          user.registrationSource === "SELF"
            ? "Your account is pending approval. Contact your repo admin."
            : "User is inactive.",
      },
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      error: {
        status: 403,
        message: "You are not allowed to login from this portal",
      },
    };
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    return {
      error: {
        status: 401,
        message: "Invalid credentials",
      },
    };
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({
    userId: user._id,
    role: user.role,
    companyId: user.companyId || null,
  });

  return {
    user,
    token,
  };
};

module.exports.login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await loginUserByRoles({
      email,
      password,
      allowedRoles: ["SSDI_SUPER_ADMIN", "REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"],
    });

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    return ok(
      res,
      await buildAuthResponse(result.user, result.token),
      "Logged in"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.ssdiLogin = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await loginUserByRoles({
      email,
      password,
      allowedRoles: ["SSDI_SUPER_ADMIN"],
    });

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    return ok(
      res,
      await buildAuthResponse(result.user, result.token),
      "SSDI admin login successful"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.repoAgentLogin = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await loginUserByRoles({
      email,
      password,
      allowedRoles: REPO_STAFF_LOGIN_ROLES,
    });

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    if (result.user.companyId) {
      const company = await Company.findById(result.user.companyId);
      if (!company || company.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message:
            company?.status === "PENDING"
              ? "Company is pending SSDI approval."
              : "Company is inactive or not found.",
        });
      }
    }

    return ok(
      res,
      await buildAuthResponse(result.user, result.token),
      "Repo agent login successful"
    );
  } catch (e) {
    next(e);
  }
};

const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    dateOfBirth: z.string().max(20).optional(),
    district: z.string().max(120).optional(),
    pincode: z.string().max(10).optional(),
    post: z.string().max(120).optional(),
    agencyName: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
    state: z.string().max(120).optional(),
    phone: z.string().max(20).optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  });

function formatProfileCompany(companyRecord) {
  if (!companyRecord) return null;
  const firstAgencyNumber = companyRecord.phone || "";
  return {
    companyName: companyRecord.companyName,
    companyCode: companyRecord.companyCode,
    status: companyRecord.status,
    registrationSource: companyRecord.registrationSource || "ADMIN",
    contactPersonName: companyRecord.contactPersonName || "",
    email: companyRecord.email || "",
    phone: firstAgencyNumber,
    firstAgencyNumber,
    address: companyRecord.address || "",
    panNumber: companyRecord.panNumber || "",
    gstNumber: companyRecord.gstNumber || "",
    aadhaarNumber: companyRecord.aadhaarNumber || "",
    photoUrl: publicUploadUrl(companyRecord.photoUrl),
  };
}

function formatProfileUser(user, companyRecord = null) {
  const company = formatProfileCompany(companyRecord);
  const secondAgencyNumber = user.phone || "";

  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    fatherName: user.fatherName || "",
    bloodGroup: user.bloodGroup || "",
    phone: secondAgencyNumber,
    secondAgencyNumber,
    dateOfBirth: user.dateOfBirth || "",
    role: user.role,
    companyId: user.companyId || null,
    district: user.district || "",
    pincode: user.pincode || "",
    post: user.post || "",
    agencyName: user.agencyName || "",
    address: user.address || "",
    city: user.city || "",
    state: user.state || "",
    photoUrl: publicUploadUrl(user.photoUrl),
    company,
  };
}

module.exports.refresh = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const token = signToken({
      userId: user._id,
      role: user.role,
      companyId: user.companyId || null,
    });

    return ok(res, await buildAuthResponse(user, token), "Token refreshed");
  } catch (e) {
    next(e);
  }
};

module.exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let companyRecord = null;
    if (user.companyId) {
      companyRecord = await Company.findById(user.companyId);
      if (
        companyRecord &&
        user.role !== "REPO_ADMIN" &&
        companyRecord.status !== "ACTIVE"
      ) {
        companyRecord = null;
      }
    }

    return ok(res, { user: formatProfileUser(user, companyRecord) }, "Profile");
  } catch (e) {
    next(e);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (body.name !== undefined) {
      user.name = body.name.trim();
    }
    if (body.dateOfBirth !== undefined) {
      user.dateOfBirth = body.dateOfBirth.trim();
    }
    if (body.district !== undefined) user.district = body.district.trim();
    if (body.pincode !== undefined) user.pincode = body.pincode.trim();
    if (body.post !== undefined) user.post = body.post.trim();
    if (body.agencyName !== undefined) user.agencyName = body.agencyName.trim();
    if (body.address !== undefined) user.address = body.address.trim();
    if (body.state !== undefined) user.state = body.state.trim();
    if (body.phone !== undefined && user.role === "REPO_ADMIN") {
      user.phone = body.phone.trim();
    }

    if (body.newPassword !== undefined && body.newPassword.trim()) {
      if (user.role !== "REPO_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only repo admin can change password here.",
        });
      }

      user.passwordHash = await hashPassword(body.newPassword.trim());
    }

    await user.save();

    let companyRecord = null;
    if (user.companyId) {
      companyRecord = await Company.findById(user.companyId);
      if (
        companyRecord &&
        user.role !== "REPO_ADMIN" &&
        companyRecord.status !== "ACTIVE"
      ) {
        companyRecord = null;
      }
    }

    return ok(
      res,
      { user: formatProfileUser(user, companyRecord) },
      "Profile updated"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.uploadProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo file is required.",
      });
    }

    user.photoUrl = saveProfileImage(req.file, "users", user._id);
    await user.save();

    let companyRecord = null;
    if (user.companyId) {
      companyRecord = await Company.findById(user.companyId).select(
        "companyName companyCode status photoUrl"
      );
    }

    return ok(
      res,
      { user: formatProfileUser(user, companyRecord) },
      "Profile photo updated"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.getIdCardData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let companyRecord = null;

    if (user.companyId) {
      companyRecord = await Company.findById(user.companyId).select(
        "companyName companyCode status photoUrl phone contactPersonName"
      );
    }

    return ok(
      res,
      {
        user: formatProfileUser(user, companyRecord),
      },
      "ID card data"
    );
  } catch (e) {
    next(e);
  }
};

const agentRegisterSchema = z.object({
  companyCode: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
  role: z
    .enum(["TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF", "REPO_STAFF"])
    .optional(),
});

module.exports.agentSelfRegister = async (req, res, next) => {
  try {
    const body = agentRegisterSchema.parse(req.body);
    const companyCode = body.companyCode.trim().toUpperCase();

    const company = await Company.findOne({
      companyCode,
      status: "ACTIVE",
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Invalid company code or company is not active.",
      });
    }

    const role = body.role || "REPO_STAFF";
    if (!ASSIGNABLE_REPO_ROLES.includes(role) && role !== "REPO_STAFF") {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected.",
      });
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered.",
      });
    }

    const normalizedPhone = normalizePhone(body.phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Valid mobile number is required.",
      });
    }

    const passwordHash = await hashPassword(body.password);

    const user = await User.create({
      name: body.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role,
      companyId: company._id,
      isActive: false,
      registrationSource: "SELF",
    });

    return ok(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
        message:
          "Registration submitted. Your repo admin will activate your account.",
      },
      "Agent registration submitted"
    );
  } catch (e) {
    next(e);
  }
};

module.exports.bootstrapSSDIAdmin = async (req, res, next) => {
  try {
    const exists = await User.findOne({ role: "SSDI_SUPER_ADMIN" }).lean();
    if (exists) return ok(res, {}, "SSDI admin already exists");

    const name = process.env.SSDI_ADMIN_NAME || "SSDI Admin";
    const email = (process.env.SSDI_ADMIN_EMAIL || "admin@ssdi.com").toLowerCase();
    const password = process.env.SSDI_ADMIN_PASSWORD || "Admin@123";

    const passwordHash = await hashPassword(password);

    const admin = await User.create({
      name,
      email,
      passwordHash,
      role: "SSDI_SUPER_ADMIN",
      companyId: null,
      isActive: true,
    });

    return ok(
      res,
      {
        admin: {
          id: admin._id,
          email: admin.email,
        },
        password,
      },
      "SSDI admin created"
    );
  } catch (e) {
    next(e);
  }
};