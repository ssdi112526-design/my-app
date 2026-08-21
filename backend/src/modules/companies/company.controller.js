const { z } = require("zod");
const Company = require("./company.model");
const User = require("../users/user.model");
const Subscription = require("../subscriptions/subscription.model");
const Plan = require("../plans/plan.model");
const PendingRepoAdminPhoneOtp = require("./pendingRepoAdminPhoneOtp.model");
const { hashPassword } = require("../../utils/hash");
const { ok } = require("../../utils/response");
const {
  OTP_TTL_MS,
  VERIFIED_TTL_MS,
  DEV_FIXED_OTP,
  normalizePhone,
  getOtpCodeForSend,
  isDevFixedOtp,
  hashOtp,
  verifyOtpHash,
} = require("../repoUsers/phoneOtp.util");
const {
  extractPrefix,
  generateNextCompanyCode,
} = require("./companyCode.util");
const { buildCompanyFilter, EXPORT_LIMIT } = require("./companyFilter.util");
const { sendExcelDownload, formatDate } = require("../../utils/excelExport");
const { mapCompanyToExcelRow } = require("./companyExcelRows");
const {
  saveProfileImage,
  publicUploadUrl,
} = require("../../utils/profileImageStorage");
const { COMPANY_USER_ROLES } = require("../../constants/repoRoles");
const { formatRepoRole } = require("../../utils/repoRoleLabels");

const createCompanySchema = z.object({
  companyCode: z.string().min(2).max(20).optional(),
  companyName: z.string().min(2),
  contactPersonName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  ownerName: z.string().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminPhone: z.string().min(10).max(15),
  adminAddress: z.string().optional(),
  adminDistrict: z.string().optional(),
  adminState: z.string().optional(),
  adminPincode: z.string().optional(),
  adminPost: z.string().optional(),
  adminAgencyName: z.string().optional(),
  adminAgencyNumber: z.string().optional(),
  adminDateOfBirth: z.string().optional(),
  planId: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed === "" ? undefined : trimmed;
      }
      return val;
    },
    z.string().min(1).optional()
  ),
});

const registerCompanySchema = z.object({
  companyName: z.string().min(2),
  contactPersonName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  ownerName: z.string().optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminPhone: z.string().min(10).max(15),
  adminAddress: z.string().optional(),
  adminDistrict: z.string().optional(),
  adminState: z.string().optional(),
  adminPincode: z.string().optional(),
  adminPost: z.string().optional(),
  adminAgencyName: z.string().optional(),
  adminAgencyNumber: z.string().optional(),
  adminDateOfBirth: z.string().optional(),
});

const updateCompanySchema = z
  .object({
    companyName: z.string().min(2).optional(),
    contactPersonName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    ownerName: z.string().optional(),
    gstNumber: z.string().optional(),
    panNumber: z.string().optional(),
    aadhaarNumber: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    blockReason: z.string().trim().optional(),
    adminPhone: z.string().min(10).max(15).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "INACTIVE") {
      const reason = (data.blockReason || "").trim();
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blockReason"],
          message: "Block reason is required (at least 3 characters).",
        });
      }
    }
  });

const resetSchema = z.object({
  newPassword: z.string().min(6),
});

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function assertRepoAdminPhoneVerified(phone, createdBy) {
  const verified = await PendingRepoAdminPhoneOtp.findOne({
    phone,
    createdBy,
    status: "VERIFIED",
    verifiedAt: { $gte: new Date(Date.now() - VERIFIED_TTL_MS) },
  }).sort({ verifiedAt: -1 });

  return Boolean(verified);
}

async function sendRepoAdminPhoneOtp(req, res, next) {
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
    const createdBy = req.user.userId || req.user._id;

    await PendingRepoAdminPhoneOtp.updateMany(
      { phone, createdBy, status: "PENDING" },
      { status: "EXPIRED" }
    );

    await PendingRepoAdminPhoneOtp.create({
      phone,
      otpHash: hashOtp(otpCode),
      expiresAt,
      status: "PENDING",
      createdBy,
    });

    console.log(`[OTP] Repo admin create — use OTP ${DEV_FIXED_OTP} for ${phone}`);

    return res.json({
      success: true,
      message: `Use OTP ${DEV_FIXED_OTP} (test mode — SMS not sent).`,
      data: {
        phone,
        devOtp: DEV_FIXED_OTP,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      },
    });
  } catch (e) {
    next(e);
  }
}

async function verifyRepoAdminPhoneOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;
    const createdBy = req.user.userId || req.user._id;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required.",
      });
    }

    const otpTrimmed = String(otp).trim();

    if (isDevFixedOtp(otpTrimmed)) {
      await PendingRepoAdminPhoneOtp.updateMany(
        { phone, createdBy, status: "PENDING" },
        { status: "EXPIRED" }
      );
      await PendingRepoAdminPhoneOtp.create({
        phone,
        otpHash: hashOtp(DEV_FIXED_OTP),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        status: "VERIFIED",
        verifiedAt: new Date(),
        createdBy,
      });
    } else {
      const record = await PendingRepoAdminPhoneOtp.findOne({
        phone,
        createdBy,
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
      message: "Repo admin mobile verified successfully.",
      data: { phone, verified: true },
    });
  } catch (e) {
    next(e);
  }
}

async function createCompany(req, res, next) {
  try {
    const body = createCompanySchema.parse(req.body);

    let plan = null;
    if (body.planId) {
      plan = await Plan.findById(body.planId);
      if (!plan || !plan.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid planId",
        });
      }
    }

    if (body.status === "INACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot create firm / agency while status is Deactivate. Set status to Active.",
      });
    }

    const companyCode = await generateNextCompanyCode(body.companyName, Company);
    const companyStatus = "ACTIVE";

    const company = await Company.create({
      companyCode,
      companyName: body.companyName,
      contactPersonName: body.contactPersonName,
      email: body.email ? body.email.toLowerCase() : undefined,
      phone: body.phone,
      address: body.address,
      ownerName: body.ownerName,
      gstNumber: body.gstNumber,
      panNumber: body.panNumber,
      aadhaarNumber: body.aadhaarNumber,
      createdBy: req.user._id,
      status: companyStatus,
      registrationSource: "ADMIN",
      paymentStatus: "PAID",
    });

    const normalizedAdminPhone = normalizePhone(body.adminPhone);
    if (!normalizedAdminPhone) {
      return res.status(400).json({
        success: false,
        message: "Valid repo admin mobile is required (at least 10 digits).",
      });
    }

    const createdBy = req.user.userId || req.user._id;
    let phoneOk = await assertRepoAdminPhoneVerified(
      normalizedAdminPhone,
      createdBy
    );

    if (!phoneOk) {
      await PendingRepoAdminPhoneOtp.create({
        phone: normalizedAdminPhone,
        otpHash: hashOtp(DEV_FIXED_OTP),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        status: "VERIFIED",
        verifiedAt: new Date(),
        createdBy,
      });
      phoneOk = true;
    }

    const passwordHash = await hashPassword(body.adminPassword);

    const repoAdmin = await User.create({
      name: body.adminName,
      email: body.adminEmail.toLowerCase(),
      phone: normalizedAdminPhone,
      address: body.adminAddress || "",
      district: body.adminDistrict || "",
      pincode: body.adminPincode || "",
      post: body.adminPost || "",
      state: body.adminState || "",
      agencyName: body.adminAgencyNumber || body.adminAgencyName || "",
      dateOfBirth: body.adminDateOfBirth || "",
      passwordHash,
      role: "REPO_ADMIN",
      companyId: company._id,
      isActive: true,
      registrationSource: "ADMIN",
    });

    await PendingRepoAdminPhoneOtp.deleteMany({
      phone: normalizedAdminPhone,
      createdBy: req.user.userId || req.user._id,
      status: "VERIFIED",
    });

    company.repoAdminUserId = repoAdmin._id;
    await company.save();

    let subscription = null;
    if (plan) {
      const startDate = new Date();
      const endDate = addMonths(startDate, plan.durationMonths);

      const tierId = plan.tierId || "free";
      const paymentStatus =
        plan.billingType === "MONTHLY_FLAT" && plan.monthlyPrice > 0 ? "UNPAID" : "PAID";

      subscription = await Subscription.create({
        companyId: company._id,
        planId: plan._id,
        tierId,
        startDate,
        endDate,
        status: "ACTIVE",
        paymentStatus,
        schemeBlocked: false,
        blockedReason: null,
        nextReminderAt: addMonths(startDate, plan.durationMonths - 0.2),
      });
    }

    const responseData = {
      company,
      repoAdmin: {
        id: repoAdmin._id,
        email: repoAdmin.email,
        phone: repoAdmin.phone,
        password: body.adminPassword,
      },
    };

    if (subscription) {
      responseData.subscription = subscription;
    }

    return ok(res, responseData, "Company created");
  } catch (e) {
    next(e);
  }
}

async function listCompanies(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      250
    );
    const filter = buildCompanyFilter(req.query);

    const total = await Company.countDocuments(filter);

    const items = await Company.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("repoAdminUserId", "email name role phone isActive registrationSource");

    return ok(res, { page, limit, total, items }, "Companies");
  } catch (e) {
    next(e);
  }
}

async function getCompany(req, res, next) {
  try {
    const { id } = req.params;
    const mongoose = require("mongoose");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid company id",
      });
    }

    const company = await Company.findById(id).populate(
      "repoAdminUserId",
      "email name role phone isActive registrationSource"
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const subscription = await Subscription.findOne({
      companyId: company._id,
    }).populate("planId");

    return ok(res, { company, subscription }, "Company");
  } catch (e) {
    next(e);
  }
}

async function updateCompany(req, res, next) {
  try {
    const body = updateCompanySchema.parse(req.body);

    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const { blockReason, status, adminPhone, ...rest } = body;

    Object.assign(company, {
      ...rest,
      email: body.email ? body.email.toLowerCase() : company.email,
    });

    if (adminPhone !== undefined && company.repoAdminUserId) {
      const admin = await User.findById(company.repoAdminUserId);
      if (admin) {
        admin.phone = String(adminPhone).trim();
        await admin.save();
      }
    }

    if (status === "INACTIVE") {
      company.status = "INACTIVE";
      company.blockReason = blockReason.trim();
      company.blockedAt = new Date();
    } else if (status === "ACTIVE") {
      company.status = "ACTIVE";
      company.blockReason = null;
      company.blockedAt = null;
    } else if (status !== undefined) {
      company.status = status;
    }

    await company.save();

    return ok(res, { company }, "Company updated");
  } catch (e) {
    next(e);
  }
}

async function resetRepoAdminPassword(req, res, next) {
  try {
    const body = resetSchema.parse(req.body);

    const company = await Company.findById(req.params.id);
    if (!company || !company.repoAdminUserId) {
      return res.status(404).json({
        success: false,
        message: "Company/admin not found",
      });
    }

    const admin = await User.findById(company.repoAdminUserId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    admin.passwordHash = await hashPassword(body.newPassword);
    await admin.save();

    return ok(
      res,
      {
        repoAdmin: {
          id: admin._id,
          email: admin.email,
          password: body.newPassword,
        },
      },
      "Repo admin password reset"
    );
  } catch (e) {
    next(e);
  }
}

async function deleteCompany(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    await Subscription.deleteMany({ companyId: company._id });
    await User.deleteMany({ companyId: company._id });
    await Company.findByIdAndDelete(company._id);

    return ok(res, {}, "Company deleted");
  } catch (e) {
    next(e);
  }
}

async function getNextCompanyCode(req, res, next) {
  try {
    const companyName = (req.query.companyName || "").trim();

    if (companyName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters of the company name.",
      });
    }

    const prefix = extractPrefix(companyName);
    const companyCode = await generateNextCompanyCode(companyName, Company);

    return ok(
      res,
      { companyCode, prefix },
      "Next company code"
    );
  } catch (e) {
    next(e);
  }
}

async function exportCompanies(req, res, next) {
  try {
    const filter = buildCompanyFilter(req.query);

    const items = await Company.find(filter)
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT);

    const rows = items.map(mapCompanyToExcelRow);

    const status = (req.query.status || "").trim();
    const baseName =
      status === "INACTIVE" ? "blocked-companies" : "companies";
    const filename = `fastrecovery-${baseName}-${formatDate(new Date())}.xlsx`;
    const sheetName = status === "INACTIVE" ? "Blocked Companies" : "Companies";

    return sendExcelDownload(res, filename, rows, sheetName);
  } catch (e) {
    next(e);
  }
}

async function stats(req, res, next) {
  try {
    const total = await Company.countDocuments({});
    const active = await Company.countDocuments({ status: "ACTIVE" });
    const inactive = await Company.countDocuments({ status: "INACTIVE" });
    const pending = await Company.countDocuments({ status: "PENDING" });
    const pendingPayment = await Company.countDocuments({
      status: "PENDING",
      paymentStatus: "UNPAID",
    });
    const pendingUsers = await User.countDocuments({
      registrationSource: "SELF",
      isActive: false,
      role: { $ne: "REPO_ADMIN" },
    });

    return ok(
      res,
      { total, active, inactive, pending, pendingPayment, pendingUsers },
      "Stats"
    );
  } catch (e) {
    next(e);
  }
}

async function registerCompanyRequest(req, res, next) {
  try {
    const body = registerCompanySchema.parse(req.body);
    const companyCode = await generateNextCompanyCode(body.companyName, Company);
    const normalizedAdminPhone = normalizePhone(body.adminPhone);

    if (!normalizedAdminPhone) {
      return res.status(400).json({
        success: false,
        message: "Valid second confirmation number is required (at least 10 digits).",
      });
    }

    const normalizedEmail = body.adminEmail.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Admin email already exists.",
      });
    }

    const passwordHash = await hashPassword(body.adminPassword);

    const repoAdmin = await User.create({
      name: body.adminName.trim(),
      email: normalizedEmail,
      phone: normalizedAdminPhone,
      address: body.adminAddress || "",
      district: body.adminDistrict || "",
      pincode: body.adminPincode || "",
      post: body.adminPost || "",
      state: body.adminState || "",
      agencyName: body.adminAgencyNumber || body.adminAgencyName || "",
      dateOfBirth: body.adminDateOfBirth || "",
      passwordHash,
      role: "REPO_ADMIN",
      companyId: null,
      isActive: false,
      registrationSource: "SELF",
    });

    const company = await Company.create({
      companyCode,
      companyName: body.companyName.trim(),
      contactPersonName: body.contactPersonName,
      email: body.email ? body.email.toLowerCase() : undefined,
      phone: body.phone,
      address: body.address,
      ownerName: body.ownerName,
      status: "PENDING",
      registrationSource: "SELF",
      paymentStatus: "UNPAID",
      repoAdminUserId: repoAdmin._id,
      createdBy: repoAdmin._id,
    });

    repoAdmin.companyId = company._id;
    await repoAdmin.save();

    const freePlan = await Plan.findOne({ tierId: "free", isActive: true });
    if (freePlan) {
      const startDate = new Date();
      const endDate = addMonths(startDate, freePlan.durationMonths || 1);
      await Subscription.create({
        companyId: company._id,
        planId: freePlan._id,
        startDate,
        endDate,
        tierId: freePlan.tierId || "free",
        status: "ACTIVE",
        paymentStatus: "UNPAID",
      });
    }

    return ok(
      res,
      {
        company: {
          id: company._id,
          companyCode: company.companyCode,
          companyName: company.companyName,
          status: company.status,
          paymentStatus: company.paymentStatus,
          registrationSource: company.registrationSource,
        },
        message:
          "Registration submitted. Complete payment (offline or online). SSDI will activate your company after payment is confirmed.",
      },
      "Company registration submitted"
    );
  } catch (e) {
    next(e);
  }
}

async function listPendingRegistrations(req, res, next) {
  try {
    const companies = await Company.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .populate(
        "repoAdminUserId",
        "name email phone role isActive registrationSource dateOfBirth agencyName"
      )
      .lean();

    const users = await User.find({
      registrationSource: "SELF",
      isActive: false,
      role: { $ne: "REPO_ADMIN" },
    })
      .select("-passwordHash")
      .populate("companyId", "companyName companyCode status paymentStatus")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const userRows = users.map((u) => ({
      ...u,
      roleLabel: formatRepoRole(u.role),
    }));

    return ok(
      res,
      { companies, users: userRows },
      "Pending registrations"
    );
  } catch (e) {
    next(e);
  }
}

async function markCompanyPayment(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (company.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Payment can only be marked for pending registrations.",
      });
    }

    const paymentMethod =
      req.body?.paymentMethod === "ONLINE" ? "ONLINE" : "OFFLINE";
    const paymentNote = (req.body?.paymentNote || "").trim();

    company.paymentStatus = "PAID";
    company.paymentMethod = paymentMethod;
    company.paymentNote = paymentNote;
    company.paymentMarkedAt = new Date();
    await company.save();

    await Subscription.updateOne(
      { companyId: company._id },
      { paymentStatus: "PAID" }
    );

    const populated = await Company.findById(company._id).populate(
      "repoAdminUserId",
      "name email role phone isActive registrationSource"
    );

    return ok(
      res,
      { company: populated },
      "Payment marked as received. You can now approve the company."
    );
  } catch (e) {
    next(e);
  }
}

async function approveCompany(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (company.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending companies can be approved.",
      });
    }

    if (company.paymentStatus !== "PAID") {
      return res.status(400).json({
        success: false,
        message:
          "Mark payment as received before approving this company.",
      });
    }

    company.status = "ACTIVE";
    company.blockReason = null;
    company.blockedAt = null;
    await company.save();

    if (company.repoAdminUserId) {
      await User.findByIdAndUpdate(company.repoAdminUserId, { isActive: true });
    }

    const populated = await Company.findById(company._id).populate(
      "repoAdminUserId",
      "name email role phone isActive registrationSource"
    );

    return ok(res, { company: populated }, "Company approved");
  } catch (e) {
    next(e);
  }
}

async function getCompanyUsers(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const users = await User.find({
      companyId: company._id,
      role: { $in: COMPANY_USER_ROLES },
    })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    const data = users.map((u) => ({
      ...u,
      roleLabel: formatRepoRole(u.role),
    }));

    return ok(res, { users: data }, "Company users");
  } catch (e) {
    next(e);
  }
}

async function updateCompanyUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      companyId: company._id,
      role: { $in: COMPANY_USER_ROLES },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in this company.",
      });
    }

    user.isActive = isActive;
    await user.save();

    return ok(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          registrationSource: user.registrationSource,
        },
      },
      "User status updated"
    );
  } catch (e) {
    next(e);
  }
}

async function uploadCompanyPhoto(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo file is required.",
      });
    }

    company.photoUrl = saveProfileImage(req.file, "companies", company._id);
    await company.save();

    return ok(
      res,
      {
        company: {
          ...company.toObject(),
          photoUrl: publicUploadUrl(company.photoUrl),
        },
      },
      "Company photo updated"
    );
  } catch (e) {
    next(e);
  }
}

async function uploadRepoAdminPhoto(req, res, next) {
  try {
    const company = await Company.findById(req.params.id);
    if (!company || !company.repoAdminUserId) {
      return res.status(404).json({
        success: false,
        message: "Company or repo admin not found",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo file is required.",
      });
    }

    const admin = await User.findById(company.repoAdminUserId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Repo admin not found",
      });
    }

    admin.photoUrl = saveProfileImage(req.file, "users", admin._id);
    await admin.save();

    return ok(
      res,
      {
        repoAdmin: {
          id: admin._id,
          photoUrl: publicUploadUrl(admin.photoUrl),
        },
      },
      "Repo admin photo updated"
    );
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createCompany,
  registerCompanyRequest,
  approveCompany,
  markCompanyPayment,
  listPendingRegistrations,
  getCompanyUsers,
  updateCompanyUserStatus,
  sendRepoAdminPhoneOtp,
  verifyRepoAdminPhoneOtp,
  getNextCompanyCode,
  listCompanies,
  exportCompanies,
  getCompany,
  updateCompany,
  resetRepoAdminPassword,
  deleteCompany,
  stats,
  uploadCompanyPhoto,
  uploadRepoAdminPhoto,
};