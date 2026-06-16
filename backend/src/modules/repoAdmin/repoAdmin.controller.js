const { z } = require("zod");
const User = require("../users/user.model");
const Company = require("../companies/company.model");
const Subscription = require("../subscriptions/subscription.model");
const RepoCase = require("../repoCases/repoCase.model");
const OtpLog = require("../otpLogs/otpLog.model");
const BlacklistEntry = require("../blacklist/blacklist.model");
const Confirmation = require("../confirmations/confirmation.model");
const { comparePassword } = require("../../utils/hash");
const { signToken } = require("../../utils/jwt");
const { companySnapshot } = require("../../utils/companySnapshot");
const { sendExcelDownload, formatDate } = require("../../utils/excelExport");
const { mapCompanyToExcelRow } = require("../companies/companyExcelRows");
const {
  saveProfileImage,
  publicUploadUrl,
} = require("../../utils/profileImageStorage");

const updateMyCompanySchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  contactPersonName: z.string().max(500).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  panNumber: z.string().max(10).optional(),
  gstNumber: z.string().max(20).optional(),
  aadhaarNumber: z.string().max(12).optional(),
});

const { notifySsdiSuperAdmins } = require("../notifications/notification.service");

const SSDI_LOCKED_COMPANY_FIELDS = [
  "companyName",
  "panNumber",
  "gstNumber",
  "aadhaarNumber",
];

const verifyControlPanel = async (req, res) => {
  try {
    const password = req.body?.password;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    const user = await User.findById(req.user._id).select("+passwordHash");

    if (!user || user.role !== "REPO_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only repo admin can access the control panel.",
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password.",
      });
    }

    return res.json({
      success: true,
      message: "Control panel unlocked.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const loginRepoAdmin = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email,
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (user.role !== "REPO_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only repo admin can login here.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is inactive.",
      });
    }

    const company = await Company.findById(user.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    if (company.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message:
          company.status === "PENDING"
            ? "Company is pending SSDI approval."
            : "Company is inactive.",
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({
      userId: user._id,
      role: user.role,
      companyId: user.companyId || null,
    });

    return res.json({
      success: true,
      message: "Repo admin login successful.",
      data: {
        token,
        user: {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || "",
          role: user.role,
          companyId: user.companyId,
          company: companySnapshot(company),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMyCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId).populate(
      "repoAdminUserId",
      "name email role phone isActive lastLoginAt dateOfBirth district state pincode post photoUrl"
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    const admin = company.repoAdminUserId;
    return res.json({
      success: true,
      data: formatCompanyResponse(company, admin),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMySubscription = async (req, res) => {
  try {
    const { getConnectEligibility } = require("../../utils/subscriptionLimits");

    const subscription = await Subscription.findOne({ companyId: req.user.companyId })
      .sort({ createdAt: -1 })
      .populate("planId");

    const usage = await getConnectEligibility(req.user.companyId);

    return res.json({
      success: true,
      data: {
        subscription,
        usage,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const [
      totalCases,
      activeCases,
      newCasesToday,
      pendingOtp,
      blacklistedCases,
      pendingConfirmations,
      resolvedCases,
      usersCount,
      recentCases,
      latestOtpLogs,
    ] = await Promise.all([
      RepoCase.countDocuments({ companyId }),
      RepoCase.countDocuments({
        companyId,
        repoStatus: { $in: ["NEW", "IN_PROGRESS", "FOLLOW_UP", "PENDING_CONFIRMATION"] },
      }),
      RepoCase.countDocuments({
        companyId,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
      RepoCase.countDocuments({
        companyId,
        otpStatus: { $in: ["NOT_SENT", "SENT"] },
      }),
      BlacklistEntry.countDocuments({ companyId, status: "ACTIVE" }),
      Confirmation.countDocuments({ companyId, status: "PENDING" }),
      RepoCase.countDocuments({
        companyId,
        repoStatus: { $in: ["RESOLVED", "REPOSSESSED", "CLOSED"] },
      }),
      User.countDocuments({
        companyId,
        role: { $in: ["REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"] },
      }),
      RepoCase.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("caseCode customerName vehicleNumber repoStatus createdAt"),
      OtpLog.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("mobileNumber status sentAt verifiedAt"),
    ]);

    return res.json({
      success: true,
      data: {
        totalCases,
        activeCases,
        newCasesToday,
        pendingOtp,
        blacklistedCases,
        pendingConfirmations,
        resolvedCases,
        usersCount,
        recentCases,
        latestOtpLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const exportMyCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    const rows = [mapCompanyToExcelRow(company, 0)];
    const filename = `fastrecovery-company-${company.companyCode || "profile"}-${formatDate(new Date())}.xlsx`;

    return sendExcelDownload(res, filename, rows, "Company");
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const formatCompanyResponse = (company, adminUser = null) => ({
  id: company._id,
  companyName: company.companyName,
  companyCode: company.companyCode,
  contactPersonName: company.contactPersonName || "",
  email: company.email || "",
  phone: company.phone || "",
  address: company.address || "",
  panNumber: company.panNumber || "",
  gstNumber: company.gstNumber || "",
  aadhaarNumber: company.aadhaarNumber || "",
  status: company.status,
  registrationSource: company.registrationSource || "ADMIN",
  photoUrl: publicUploadUrl(company.photoUrl),
  adminPhone: adminUser?.phone || "",
  adminName: adminUser?.name || "",
  adminEmail: adminUser?.email || "",
});

const updateMyCompany = async (req, res) => {
  try {
    if (req.user.role !== "REPO_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only repo admin can update the bank / NBFC profile.",
      });
    }

    const body = updateMyCompanySchema.parse(req.body);
    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    const ssdiProvisioned = company.registrationSource === "ADMIN";

    if (ssdiProvisioned) {
      for (const field of SSDI_LOCKED_COMPANY_FIELDS) {
        if (body[field] !== undefined) {
          const next = String(body[field]).trim();
          const current = String(company[field] || "").trim();
          if (field === "companyName" && next && next !== current) {
            return res.status(403).json({
              success: false,
              message:
                "Agency name cannot be changed. It was set when SSDI created your company.",
            });
          }
          if (field !== "companyName" && next && next !== current) {
            return res.status(403).json({
              success: false,
              message: `PAN, GST, and Aadhaar cannot be changed. They were set when SSDI created your company.`,
            });
          }
        }
      }
    } else {
      if (body.companyName !== undefined) {
        company.companyName = body.companyName.trim();
      }
      if (body.panNumber !== undefined) {
        company.panNumber = body.panNumber.trim().toUpperCase();
      }
      if (body.gstNumber !== undefined) {
        company.gstNumber = body.gstNumber.trim();
      }
      if (body.aadhaarNumber !== undefined) {
        company.aadhaarNumber = body.aadhaarNumber.trim();
      }
    }

    if (body.contactPersonName !== undefined) {
      company.contactPersonName = body.contactPersonName.trim();
    }
    if (body.email !== undefined) {
      const normalizedEmail = body.email ? body.email.trim().toLowerCase() : "";
      if (normalizedEmail) {
        const existing = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: req.user.userId },
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: "Email is already in use.",
          });
        }
      }
      company.email = normalizedEmail;

      const adminUser = await User.findById(req.user.userId);
      if (adminUser?.role === "REPO_ADMIN" && adminUser.email !== normalizedEmail) {
        adminUser.email = normalizedEmail;
        await adminUser.save();
      }
    }
    if (body.phone !== undefined) {
      company.phone = body.phone.trim();
    }
    if (body.address !== undefined) {
      company.address = body.address.trim();
    }

    await company.save();

    if (company.registrationSource === "SELF") {
      await notifySsdiSuperAdmins({
        companyId: company._id,
        title: "Agency profile updated",
        message: `${company.companyName} (${company.companyCode}) updated their agency information. Review on Registrations or Companies.`,
        meta: {
          companyId: company._id,
          companyCode: company.companyCode,
          status: company.status,
        },
      });
    }

    const admin = await User.findById(req.user.userId).select(
      "name email phone"
    );

    return res.json({
      success: true,
      message: "Agency profile updated.",
      data: { company: formatCompanyResponse(company, admin) },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      const message = error.errors?.[0]?.message || "Invalid company data.";
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const uploadMyCompanyPhoto = async (req, res) => {
  try {
    if (req.user.role !== "REPO_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only repo admin can upload the bank / NBFC logo.",
      });
    }

    const company = await Company.findById(req.user.companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo image file is required.",
      });
    }

    company.photoUrl = saveProfileImage(req.file, "companies", company._id);
    await company.save();

    return res.json({
      success: true,
      message: "Company logo updated.",
      data: {
        company: formatCompanyResponse(
          company,
          await User.findById(req.user.userId)
        ),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  loginRepoAdmin,
  verifyControlPanel,
  getMe,
  getMyCompany,
  updateMyCompany,
  uploadMyCompanyPhoto,
  exportMyCompany,
  getMySubscription,
  getDashboard,
};