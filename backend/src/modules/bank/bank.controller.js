const { z } = require("zod");
const crypto = require("crypto");
const path = require("path");
const Bank = require("./bank.model");
const BankRecord = require("./bankRecord.model");
const BankRepoLink = require("./bankRepoLink.model");
const PendingBankInvite = require("./pendingBankInvite.model");
const DataUsageLog = require("./dataUsageLog.model");
const BankUploadBatch = require("./bankUploadBatch.model");
const User = require("../users/user.model");
const { hashPassword, comparePassword } = require("../../utils/hash");
const { signToken } = require("../../utils/jwt");
const { ok, fail } = require("../../utils/response");
const { createPresignedPutUrl, uploadBufferToS3 } = require("../../utils/s3Storage");
const { isUploadQueueEnabled } = require("../../config/redis");
const { enqueueUploadJob } = require("../../queues/uploadQueue");
const { processBankUploadJob } = require("../../services/bankRecordProcessor.service");
const { sanitizeBankRecordForRole } = require("../../utils/bankRecordSanitize");
const { enrichBankRecordBankerSnapshot } = require("../../utils/bankRecordEnrich");
const {
  getLinkedBankIdsForCompany,
  companyHasLinkedBank,
} = require("../../utils/bankRecordAccess");
const { deleteBankUploadAndRecords } = require("../../services/bankRecordDelete.service");
const { buildBankRecordSearchFilter } = require("../../utils/bankRecordSearch");

const AGENCY_ROLES = [
  "TEAM_LEADER",
  "HEAD_OFFICE_STAFF",
  "OFFICE_STAFF",
  "REPO_STAFF",
  "REPO_VIEWER",
];

function buildBankS3Key(bankId, batchId, fileName) {
  const ext = path.extname(fileName || "") || ".xlsx";
  const prefix = process.env.AWS_S3_UPLOAD_PREFIX || "uploads";
  return `${prefix}/bank/${String(bankId)}/${String(batchId)}${ext}`;
}

function getMime(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".xls") return "application/vnd.ms-excel";
  return "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBankCode(bankName) {
  const prefix = bankName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

async function uniqueBankCode(bankName) {
  let code = generateBankCode(bankName);
  let attempts = 0;
  while (await Bank.exists({ bankCode: code })) {
    code = generateBankCode(bankName);
    if (++attempts > 20) throw new Error("Could not generate unique bank code");
  }
  return code;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ---------------------------------------------------------------------------
// ── SSDI: Bank management ──
// ---------------------------------------------------------------------------

const optionalText = z.string().trim().optional().or(z.literal(""));

const createBankSchema = z.object({
  bankName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  gstNumber: optionalText,
  panNumber: optionalText,
  branchName: optionalText,
  adminName: z.string().min(2),
  adminPassword: z.string().min(8),
  adminBranchName: optionalText,
  adminEmployeeNumber: optionalText,
  status: z.enum(["pending_payment", "active"]).default("pending_payment"),
});

/** POST /api/bank/ssdi/create — SSDI creates a bank + admin user */
module.exports.ssdiCreateBank = async (req, res, next) => {
  try {
    const body = createBankSchema.parse(req.body);

    // Check email uniqueness
    const emailTaken = await User.findOne({ email: body.email.toLowerCase() });
    if (emailTaken) return fail(res, 400, "Email already registered");

    const bankEmailTaken = await Bank.findOne({ email: body.email.toLowerCase() });
    if (bankEmailTaken) return fail(res, 400, "Bank email already registered");

    const bankCode = await uniqueBankCode(body.bankName);
    const passwordHash = await hashPassword(body.adminPassword);

    // Create Bank doc first (no adminUserId yet)
    const bank = await Bank.create({
      bankName: body.bankName.trim(),
      bankCode,
      email: body.email.toLowerCase(),
      phone: body.phone.trim(),
      address: body.address?.trim() || "",
      city: body.city?.trim() || "",
      state: body.state?.trim() || "",
      gstNumber: (body.gstNumber || "").trim().toUpperCase(),
      panNumber: (body.panNumber || "").trim().toUpperCase(),
      branchName: (body.branchName || "").trim(),
      status: body.status,
      registrationSource: "ADMIN",
      createdBy: req.user.userId,
      activatedAt: body.status === "active" ? new Date() : null,
      nextDueAt: body.status === "active" ? addMonths(new Date(), 1) : null,
    });

    const adminBranch =
      (body.adminBranchName || "").trim() || (body.branchName || "").trim();

    // Create BANK_ADMIN user
    const adminUser = await User.create({
      name: body.adminName.trim(),
      email: body.email.toLowerCase(),
      phone: body.phone.trim(),
      passwordHash,
      role: "BANK_ADMIN",
      bankId: bank._id,
      branchName: adminBranch,
      employeeNumber: (body.adminEmployeeNumber || "").trim(),
      isActive: body.status === "active",
      registrationSource: "ADMIN",
    });

    bank.adminUserId = adminUser._id;
    await bank.save();

    // Notify SSDI admins if self-registered (not needed here since SSDI is creating)
    return ok(
      res,
      {
        bank: { id: bank._id, bankName: bank.bankName, bankCode: bank.bankCode, status: bank.status },
        admin: { id: adminUser._id, email: adminUser.email, name: adminUser.name },
        password: body.adminPassword,
      },
      "Bank created"
    );
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/ssdi/list — SSDI list all banks */
module.exports.ssdiListBanks = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { bankName: { $regex: search, $options: "i" } },
        { bankCode: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [banks, total] = await Promise.all([
      Bank.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("adminUserId", "name email phone"),
      Bank.countDocuments(filter),
    ]);

    return ok(res, { banks, total, page: Number(page), limit: Number(limit) }, "Banks list");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/ssdi/:id — SSDI get bank detail */
module.exports.ssdiGetBank = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.params.id).populate(
      "adminUserId",
      "name email phone isActive branchName employeeNumber"
    );
    if (!bank) return fail(res, 404, "Bank not found");

    const persons = await User.find({ bankId: bank._id, role: "BANK_PERSON", isActive: true }).select(
      "name email phone isActive branchName employeeNumber createdAt"
    );

    const links = await BankRepoLink.find({ bankId: bank._id })
      .populate("bankPersonId", "name email")
      .populate("repoAdminId", "name email phone");

    return ok(res, { bank, persons, links }, "Bank detail");
  } catch (e) {
    next(e);
  }
};

const updateBankStatusSchema = z.object({
  status: z.enum(["pending_payment", "active", "expired", "inactive"]),
  paymentNote: z.string().optional(),
});

/** PATCH /api/bank/ssdi/:id/status — SSDI activate / expire / deactivate */
module.exports.ssdiUpdateBankStatus = async (req, res, next) => {
  try {
    const { status, paymentNote } = updateBankStatusSchema.parse(req.body);
    const bank = await Bank.findById(req.params.id);
    if (!bank) return fail(res, 404, "Bank not found");

    const wasActive = bank.status === "active";
    bank.status = status;

    if (status === "active" && !wasActive) {
      bank.activatedAt = bank.activatedAt || new Date();
      bank.lastPaymentAt = new Date();
      bank.nextDueAt = addMonths(new Date(), 1);
    }

    if (paymentNote !== undefined) bank.paymentNote = paymentNote.trim();
    await bank.save();

    // Sync admin user's isActive
    await User.updateMany(
      { bankId: bank._id },
      { isActive: status === "active" }
    );

    return ok(res, { bank }, "Bank status updated");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/ssdi/:id/renew — SSDI marks payment received, resets cycle */
module.exports.ssdiRenewBank = async (req, res, next) => {
  try {
    const bank = await Bank.findById(req.params.id);
    if (!bank) return fail(res, 404, "Bank not found");

    bank.status = "active";
    bank.lastPaymentAt = new Date();
    bank.nextDueAt = addMonths(new Date(), 1);
    if (req.body.note) bank.paymentNote = String(req.body.note).trim();
    await bank.save();

    await User.updateMany({ bankId: bank._id }, { isActive: true });

    return ok(res, { bank }, "Bank renewed for one month");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Bank self-registration ──
// ---------------------------------------------------------------------------

const selfRegisterSchema = z.object({
  bankName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  gstNumber: optionalText,
  panNumber: optionalText,
  branchName: optionalText,
  adminName: z.string().min(2),
  adminPassword: z.string().min(8),
  adminBranchName: optionalText,
  adminEmployeeNumber: optionalText,
});

/** POST /api/bank/register — public self-registration */
module.exports.selfRegister = async (req, res, next) => {
  try {
    const body = selfRegisterSchema.parse(req.body);

    const emailTaken = await User.findOne({ email: body.email.toLowerCase() });
    if (emailTaken) return fail(res, 400, "Email already registered");

    const bankEmailTaken = await Bank.findOne({ email: body.email.toLowerCase() });
    if (bankEmailTaken) return fail(res, 400, "Bank email already registered");

    const bankCode = await uniqueBankCode(body.bankName);
    const passwordHash = await hashPassword(body.adminPassword);

    const bank = await Bank.create({
      bankName: body.bankName.trim(),
      bankCode,
      email: body.email.toLowerCase(),
      phone: body.phone.trim(),
      address: body.address?.trim() || "",
      city: body.city?.trim() || "",
      state: body.state?.trim() || "",
      gstNumber: (body.gstNumber || "").trim().toUpperCase(),
      panNumber: (body.panNumber || "").trim().toUpperCase(),
      branchName: (body.branchName || "").trim(),
      status: "pending_payment",
      registrationSource: "SELF",
    });

    const adminBranch =
      (body.adminBranchName || "").trim() || (body.branchName || "").trim();

    const adminUser = await User.create({
      name: body.adminName.trim(),
      email: body.email.toLowerCase(),
      phone: body.phone.trim(),
      passwordHash,
      role: "BANK_ADMIN",
      bankId: bank._id,
      branchName: adminBranch,
      employeeNumber: (body.adminEmployeeNumber || "").trim(),
      isActive: false, // SSDI must activate
      registrationSource: "SELF",
    });

    bank.adminUserId = adminUser._id;
    await bank.save();

    // Notify all SSDI admins
    try {
      const ssdiAdmins = await User.find({ role: "SSDI_SUPER_ADMIN", isActive: true }).select("_id");
      const Notification = require("../notifications/notification.model");
      if (ssdiAdmins.length) {
        await Notification.insertMany(
          ssdiAdmins.map((a) => ({
            companyId: bank._id, // reuse field as bankId
            userId: a._id,
            type: "BANK_REGISTRATION",
            title: "New Bank Registration",
            message: `${bank.bankName} has registered and is pending payment approval.`,
            meta: { bankId: bank._id, bankCode: bank.bankCode },
          }))
        );
      }
    } catch {
      /* notification optional */
    }

    return ok(
      res,
      { message: "Registration submitted. SSDI will activate your account after payment." },
      "Bank registration submitted"
    );
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Bank login ──
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** GET /api/bank/public/banks — active banks for login dropdown */
module.exports.listPublicBanks = async (req, res, next) => {
  try {
    const banks = await Bank.find({ status: "active" })
      .select("bankName bankCode branchName")
      .sort({ bankName: 1 })
      .lean();

    return ok(res, { banks }, "Banks");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/login */
module.exports.bankLogin = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role: { $in: ["BANK_ADMIN", "BANK_PERSON"] },
    }).select("+passwordHash");

    if (!user) return fail(res, 401, "Invalid credentials");

    if (!user.isActive) {
      return fail(res, 403, "Your account is not active. Contact SSDI or your bank admin.");
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) return fail(res, 401, "Invalid credentials");

    // Check bank status
    const bank = await Bank.findById(user.bankId);
    if (!bank || bank.status !== "active") {
      return fail(res, 403, "Bank account is not active. Please contact SSDI.");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ userId: user._id, role: user.role, bankId: user.bankId });

    return ok(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          bankId: user.bankId,
          bank: {
            id: bank._id,
            bankName: bank.bankName,
            bankCode: bank.bankCode,
            status: bank.status,
            gstNumber: bank.gstNumber,
            panNumber: bank.panNumber,
            branchName: bank.branchName,
          },
          branchName: user.branchName,
          employeeNumber: user.employeeNumber,
        },
      },
      "Login successful"
    );
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Bank Admin: manage persons ──
// ---------------------------------------------------------------------------

const createPersonSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8),
  branchName: optionalText,
  employeeNumber: optionalText,
});

/** POST /api/bank/persons — Bank Admin invites / creates a Bank Person */
module.exports.createPerson = async (req, res, next) => {
  try {
    const body = createPersonSchema.parse(req.body);
    const bankId = req.user.bankId;

    if (!bankId) return fail(res, 403, "No bank context");

    const taken = await User.findOne({ email: body.email.toLowerCase() });
    if (taken) return fail(res, 400, "Email already registered");

    const passwordHash = await hashPassword(body.password);

    const bank = await Bank.findById(bankId).select("branchName");
    const branchName =
      (body.branchName || "").trim() || String(bank?.branchName || "").trim();

    const person = await User.create({
      name: body.name.trim(),
      email: body.email.toLowerCase(),
      phone: body.phone.trim(),
      passwordHash,
      role: "BANK_PERSON",
      bankId,
      branchName,
      employeeNumber: (body.employeeNumber || "").trim(),
      isActive: true,
      registrationSource: "ADMIN",
    });

    return ok(
      res,
      {
        person: {
          id: person._id,
          name: person.name,
          email: person.email,
          phone: person.phone,
          branchName: person.branchName,
          employeeNumber: person.employeeNumber,
        },
      },
      "Bank person created"
    );
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/persons — list persons in my bank */
module.exports.listPersons = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    const persons = await User.find({ bankId, role: "BANK_PERSON" }).select(
      "name email phone isActive branchName employeeNumber createdAt"
    ).sort({ createdAt: -1 });

    return ok(res, { persons }, "Persons list");
  } catch (e) {
    next(e);
  }
};

/** PATCH /api/bank/persons/:id/toggle — Bank Admin activate/deactivate a person */
module.exports.togglePerson = async (req, res, next) => {
  try {
    const person = await User.findOne({ _id: req.params.id, bankId: req.user.bankId, role: "BANK_PERSON" });
    if (!person) return fail(res, 404, "Person not found");

    person.isActive = !person.isActive;
    await person.save();

    return ok(res, { isActive: person.isActive }, "Person updated");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Bank Records ──
// ---------------------------------------------------------------------------

/** POST /api/bank/records — upload individual record */
module.exports.createRecord = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    if (!bankId) return fail(res, 403, "No bank context");

    const {
      vehicleNumber, chassisNumber, engineNumber,
      borrowerName, borrowerPhone, borrowerAddress,
      loanAccountNumber, loanAmount, outstandingAmount,
      vehicleMake, vehicleModel, vehicleYear,
      branchName, branchCode, extraFields,
    } = req.body;

    const record = await BankRecord.create({
      bankId,
      uploadedBy: req.user.userId,
      vehicleNumber: vehicleNumber?.trim() || "",
      chassisNumber: chassisNumber?.trim() || "",
      engineNumber: engineNumber?.trim() || "",
      borrowerName: borrowerName?.trim() || "",
      borrowerPhone: borrowerPhone?.trim() || "",
      borrowerAddress: borrowerAddress?.trim() || "",
      loanAccountNumber: loanAccountNumber?.trim() || "",
      loanAmount: loanAmount ? Number(loanAmount) : null,
      outstandingAmount: outstandingAmount ? Number(outstandingAmount) : null,
      vehicleMake: vehicleMake?.trim() || "",
      vehicleModel: vehicleModel?.trim() || "",
      vehicleYear: vehicleYear?.trim() || "",
      branchName: branchName?.trim() || "",
      branchCode: branchCode?.trim() || "",
      extraFields: extraFields || {},
    });

    return ok(res, { record }, "Record created");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/records/bulk — bulk insert from parsed Excel rows */
module.exports.bulkCreateRecords = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    if (!bankId) return fail(res, 403, "No bank context");

    const { rows, batchId } = req.body;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 400, "No rows provided");

    const docs = rows.map((r) => ({
      bankId,
      uploadedBy: req.user.userId,
      batchId: batchId || null,
      vehicleNumber: r.vehicleNumber?.trim() || "",
      chassisNumber: r.chassisNumber?.trim() || "",
      engineNumber: r.engineNumber?.trim() || "",
      borrowerName: r.borrowerName?.trim() || "",
      borrowerPhone: r.borrowerPhone?.trim() || "",
      borrowerAddress: r.borrowerAddress?.trim() || "",
      loanAccountNumber: r.loanAccountNumber?.trim() || "",
      loanAmount: r.loanAmount ? Number(r.loanAmount) : null,
      outstandingAmount: r.outstandingAmount ? Number(r.outstandingAmount) : null,
      vehicleMake: r.vehicleMake?.trim() || "",
      vehicleModel: r.vehicleModel?.trim() || "",
      vehicleYear: r.vehicleYear?.trim() || "",
      branchName: r.branchName?.trim() || "",
      branchCode: r.branchCode?.trim() || "",
      extraFields: r.extraFields || {},
    }));

    const inserted = await BankRecord.insertMany(docs, { ordered: false });
    return ok(res, { inserted: inserted.length }, `${inserted.length} records saved`);
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/records/:id — single record with full details */
module.exports.getRecordById = async (req, res, next) => {
  try {
    const { role, bankId, userId } = req.user;
    const record = await BankRecord.findById(req.params.id)
      .populate("uploadedBy", "name email role")
      .populate("bankId", "bankName bankCode");

    if (!record) return fail(res, 404, "Record not found");

    if (role === "BANK_ADMIN") {
      if (String(record.bankId?._id || record.bankId) !== String(bankId)) {
        return fail(res, 403, "Access denied");
      }
    } else if (role === "BANK_PERSON") {
      if (
        String(record.bankId?._id || record.bankId) !== String(bankId) ||
        String(record.uploadedBy?._id || record.uploadedBy) !== String(userId)
      ) {
        return fail(res, 403, "Access denied");
      }
    } else if (role === "REPO_ADMIN") {
      const linked = await BankRepoLink.findOne({
        repoAdminId: userId,
        bankId: record.bankId?._id || record.bankId,
        isActive: true,
      });
      if (!linked) return fail(res, 403, "Access denied");
    } else if (AGENCY_ROLES.includes(role)) {
      const bankId = String(record.bankId?._id || record.bankId || "");
      const allowed = await companyHasLinkedBank(req.user.companyId, bankId);
      if (!allowed) return fail(res, 403, "Access denied");
    } else {
      return fail(res, 403, "Access denied");
    }

    let payload = enrichBankRecordBankerSnapshot(record);
    payload = sanitizeBankRecordForRole(payload, role);
    return ok(res, { record: payload }, "Record details");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/records — list records visible to the caller */
module.exports.listRecords = async (req, res, next) => {
  try {
    const { role, bankId, userId } = req.user;
    const { page = 1, limit = 30, search } = req.query;
    const filter = {};

    if (role === "BANK_ADMIN") {
      // Admin sees all records in the bank
      filter.bankId = bankId;
    } else {
      // Bank Person sees only their own
      filter.uploadedBy = userId;
      filter.bankId = bankId;
    }

    const searchFilter = buildBankRecordSearchFilter(search);
    if (searchFilter) Object.assign(filter, searchFilter);

    const skip = (Number(page) - 1) * Number(limit);
    const [rawRecords, total] = await Promise.all([
      BankRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("uploadedBy", "name email"),
      BankRecord.countDocuments(filter),
    ]);

    const records = rawRecords.map((r) => enrichBankRecordBankerSnapshot(r));

    return ok(res, { records, total, page: Number(page), limit: Number(limit) }, "Records");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── SSDI: BankRepoLink management ──
// ---------------------------------------------------------------------------

const createLinkSchema = z.object({
  bankPersonId: z.string().min(1),
  repoAdminId: z.string().min(1),
});

/** POST /api/bank/ssdi/links — SSDI creates a banker ↔ agency link */
module.exports.ssdiCreateLink = async (req, res, next) => {
  try {
    const { bankPersonId, repoAdminId } = createLinkSchema.parse(req.body);

    const banker = await User.findOne({
      _id: bankPersonId,
      role: { $in: ["BANK_ADMIN", "BANK_PERSON"] },
    });
    if (!banker) return fail(res, 404, "Banker not found");

    const repoAdmin = await User.findOne({ _id: repoAdminId, role: "REPO_ADMIN" });
    if (!repoAdmin) return fail(res, 404, "Repo admin not found");

    const existing = await BankRepoLink.findOne({ bankPersonId, repoAdminId });
    if (existing) return fail(res, 400, "Link already exists");

    const link = await BankRepoLink.create({
      bankPersonId,
      bankId: banker.bankId,
      repoAdminId,
      linkedBy: req.user.userId,
    });

    return ok(res, { link }, "Link created");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/ssdi/links — SSDI list all links */
module.exports.ssdiListLinks = async (req, res, next) => {
  try {
    const links = await BankRepoLink.find()
      .populate("bankPersonId", "name email role")
      .populate("bankId", "bankName bankCode")
      .populate("repoAdminId", "name email phone")
      .sort({ createdAt: -1 });

    return ok(res, { links }, "Links");
  } catch (e) {
    next(e);
  }
};

/** DELETE /api/bank/ssdi/links/:id — SSDI remove a link */
module.exports.ssdiDeleteLink = async (req, res, next) => {
  try {
    await BankRepoLink.findByIdAndDelete(req.params.id);
    return ok(res, {}, "Link removed");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── SSDI: Pending invite for unregistered agency ──
// ---------------------------------------------------------------------------

const createInviteSchema = z.object({
  bankPersonId: z.string().min(1),
  agencyEmail: z.string().email().optional(),
  agencyName: z.string().optional(),
});

/** POST /api/bank/ssdi/invites — SSDI creates invite for agency not yet registered */
module.exports.ssdiCreateInvite = async (req, res, next) => {
  try {
    const body = createInviteSchema.parse(req.body);

    const banker = await User.findOne({
      _id: body.bankPersonId,
      role: { $in: ["BANK_ADMIN", "BANK_PERSON"] },
    });
    if (!banker) return fail(res, 404, "Banker not found");

    const invite = await PendingBankInvite.create({
      bankPersonId: body.bankPersonId,
      bankId: banker.bankId,
      agencyEmail: body.agencyEmail || "",
      agencyName: body.agencyName || "",
      createdBy: req.user.userId,
    });

    const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/bank-invite?token=${invite.token}`;

    return ok(res, { invite, inviteUrl }, "Invite created");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/ssdi/invites — SSDI list pending invites */
module.exports.ssdiListInvites = async (req, res, next) => {
  try {
    const invites = await PendingBankInvite.find()
      .populate("bankPersonId", "name email")
      .populate("bankId", "bankName bankCode")
      .sort({ createdAt: -1 });
    return ok(res, { invites }, "Invites");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/invite/:token — validate invite token (public) */
module.exports.getInviteByToken = async (req, res, next) => {
  try {
    const invite = await PendingBankInvite.findOne({
      token: req.params.token,
      status: "pending",
    }).populate("bankPersonId", "name email").populate("bankId", "bankName bankCode");

    if (!invite) return fail(res, 404, "Invalid or expired invite");
    if (invite.expiresAt < new Date()) {
      invite.status = "expired";
      await invite.save();
      return fail(res, 410, "Invite has expired");
    }

    return ok(res, { invite }, "Invite valid");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Banker tracing view ──
// ---------------------------------------------------------------------------

/** GET /api/bank/tracing — Banker sees which agencies + tracers use their data */
module.exports.getTracingView = async (req, res, next) => {
  try {
    const { role, bankId, userId } = req.user;

    // Build the list of bankPersonIds we can see
    let bankPersonIds;
    if (role === "BANK_ADMIN") {
      // Admin sees all persons in the bank
      const persons = await User.find({ bankId, role: { $in: ["BANK_ADMIN", "BANK_PERSON"] } }).select("_id");
      bankPersonIds = persons.map((p) => p._id);
    } else {
      bankPersonIds = [userId];
    }

    // Get all links for these bankers
    const links = await BankRepoLink.find({ bankPersonId: { $in: bankPersonIds }, isActive: true })
      .populate("repoAdminId", "name email phone")
      .populate("bankPersonId", "name email");

    // For each link, get the usage logs
    const repoAdminIds = links.map((l) => l.repoAdminId._id || l.repoAdminId);

    const usageLogs = await DataUsageLog.find({
      uploadedBy: { $in: bankPersonIds },
      repoAdminId: { $in: repoAdminIds },
      status: "active",
    })
      .populate("tracerId", "name email phone role")
      .populate("repoAdminId", "name email phone")
      .populate("bankRecordId", "vehicleNumber borrowerName loanAccountNumber");

    // Group by repoAdminId
    const grouped = {};
    for (const link of links) {
      const rid = String(link.repoAdminId._id || link.repoAdminId);
      if (!grouped[rid]) {
        grouped[rid] = {
          repoAdmin: link.repoAdmin || link.repoAdminId,
          banker: link.bankPersonId,
          tracers: [],
          recordCount: 0,
        };
      }
    }

    for (const log of usageLogs) {
      const rid = String(log.repoAdminId._id || log.repoAdminId);
      if (grouped[rid]) {
        grouped[rid].recordCount += 1;
        if (log.tracerId) {
          const tid = String(log.tracerId._id || log.tracerId);
          const already = grouped[rid].tracers.find((t) => String(t.id) === tid);
          if (!already) {
            grouped[rid].tracers.push({
              id: log.tracerId._id,
              name: log.tracerId.name,
              email: log.tracerId.email,
              role: log.tracerId.role,
            });
          }
        }
      }
    }

    return ok(res, { agencies: Object.values(grouped) }, "Tracing view");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Repo Admin: get bank records linked to them ──
// ---------------------------------------------------------------------------

/** GET /api/bank/repo-records — Repo Admin fetches records from their linked bankers */
module.exports.repoAdminGetLinkedRecords = async (req, res, next) => {
  try {
    const repoAdminId = req.user.userId;
    const { page = 1, limit = 30, search } = req.query;

    // Find all bankers linked to this repo admin
    const links = await BankRepoLink.find({ repoAdminId, isActive: true });
    const bankIds = [...new Set(links.map((l) => String(l.bankId)).filter(Boolean))];

    if (!bankIds.length) return ok(res, { records: [], total: 0 }, "No linked banks");

    // All records from linked banks (bank admin + bank person uploads)
    const filter = { bankId: { $in: bankIds } };
    const searchFilter = buildBankRecordSearchFilter(search);
    if (searchFilter) Object.assign(filter, searchFilter);

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      BankRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("uploadedBy", "name email")
        .populate("bankId", "bankName bankCode"),
      BankRecord.countDocuments(filter),
    ]);

    const enriched = records.map((r) => enrichBankRecordBankerSnapshot(r));
    return ok(res, { records: enriched, total, page: Number(page) }, "Linked bank records");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/assigned-records — Agency staff: all records from banks linked to their company */
module.exports.agencyGetAssignedRecords = async (req, res, next) => {
  try {
    const role = req.user.role;
    const { page = 1, limit = 30, search } = req.query;

    const bankIds = await getLinkedBankIdsForCompany(req.user.companyId);
    if (!bankIds.length) {
      return ok(
        res,
        { records: [], total: 0, page: Number(page) },
        "No banks linked to your agency"
      );
    }

    const filter = { bankId: { $in: bankIds } };
    const searchFilter = buildBankRecordSearchFilter(search);
    if (searchFilter) Object.assign(filter, searchFilter);

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      BankRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("uploadedBy", "name email")
        .populate("bankId", "bankName bankCode"),
      BankRecord.countDocuments(filter),
    ]);

    const sanitized = records.map((r) => {
      const enriched = enrichBankRecordBankerSnapshot(r);
      return sanitizeBankRecordForRole(enriched, role);
    });
    return ok(res, { records: sanitized, total, page: Number(page) }, "Agency bank records");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/repo-records/:recordId/assign — Repo Admin assigns record to tracer */
module.exports.assignRecord = async (req, res, next) => {
  try {
    const { tracerId } = req.body;
    const repoAdminId = req.user.userId;
    const { recordId } = req.params;

    const record = await BankRecord.findById(recordId);
    if (!record) return fail(res, 404, "Record not found");

    const link = await BankRepoLink.findOne({
      repoAdminId,
      bankId: record.bankId,
      isActive: true,
    });
    if (!link) return fail(res, 403, "You are not linked to this bank");

    const tracer = await User.findOne({ _id: tracerId, companyId: req.user.companyId });
    if (!tracer) return fail(res, 404, "Tracer not found");

    // Create / update usage log
    const existing = await DataUsageLog.findOne({ bankRecordId: recordId, repoAdminId, status: "active" });
    if (existing) {
      existing.tracerId = tracerId;
      await existing.save();
    } else {
      await DataUsageLog.create({
        bankRecordId: recordId,
        uploadedBy: record.uploadedBy,
        bankId: record.bankId,
        repoAdminId,
        tracerId,
      });
    }

    record.status = "assigned";
    await record.save();

    return ok(res, {}, "Record assigned to tracer");
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Cron: expire unpaid banks (call from a daily cron job) ──
// ---------------------------------------------------------------------------

/** POST /api/bank/ssdi/run-expiry — SSDI triggers manual expiry check */
module.exports.runExpiryCheck = async (req, res, next) => {
  try {
    const now = new Date();
    const expired = await Bank.find({ status: "active", nextDueAt: { $lt: now } });

    const ids = expired.map((b) => b._id);
    if (ids.length) {
      await Bank.updateMany({ _id: { $in: ids } }, { status: "expired" });
      await User.updateMany({ bankId: { $in: ids } }, { isActive: false });

      // Notify SSDI
      try {
        const Notification = require("../notifications/notification.model");
        const ssdiAdmins = await User.find({ role: "SSDI_SUPER_ADMIN", isActive: true }).select("_id");
        if (ssdiAdmins.length && ids.length) {
          const docs = [];
          for (const bankId of ids) {
            for (const admin of ssdiAdmins) {
              docs.push({
                companyId: bankId,
                userId: admin._id,
                type: "BANK_PAYMENT_EXPIRED",
                title: "Bank Payment Expired",
                message: `A bank's monthly payment is overdue. Status changed to expired.`,
                meta: { bankId },
              });
            }
          }
          await Notification.insertMany(docs);
        }
      } catch {/* optional */}
    }

    return ok(res, { expiredCount: ids.length }, `${ids.length} banks expired`);
  } catch (e) {
    next(e);
  }
};

// ---------------------------------------------------------------------------
// ── Bank Records: S3 presigned upload ──
// ---------------------------------------------------------------------------

/** POST /api/bank/uploads/presign — Step 1: get presigned S3 URL */
module.exports.presignBankUpload = async (req, res, next) => {
  try {
    const { fileName } = req.body;
    const bankId = req.user.bankId;
    if (!bankId) return fail(res, 403, "No bank context");
    if (!fileName) return fail(res, 400, "fileName is required");

    const batch = await BankUploadBatch.create({
      bankId,
      uploadedBy: req.user.userId,
      fileName: String(fileName).trim(),
      status: "pending",
    });

    const s3Key = buildBankS3Key(bankId, batch._id, fileName);
    const mime = getMime(fileName);
    const { uploadUrl, contentType: signedType } = await createPresignedPutUrl(s3Key, mime);

    batch.storedFilePath = s3Key;
    await batch.save();

    return ok(res, { batchId: batch._id, uploadUrl, s3Key, contentType: signedType }, "Presigned URL ready");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/uploads/proxy — CORS fallback: server PUTs the file to S3 */
module.exports.proxyBankUpload = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    const batchId = req.body.batchId;
    if (!bankId) return fail(res, 403, "No bank context");
    if (!req.file) return fail(res, 400, "File is required");
    if (!batchId) return fail(res, 400, "batchId is required");

    const batch = await BankUploadBatch.findOne({ _id: batchId, bankId });
    if (!batch || !batch.storedFilePath) return fail(res, 404, "Batch not found — presign again");

    await uploadBufferToS3({
      key: batch.storedFilePath,
      buffer: req.file.buffer,
      contentType: req.file.mimetype || getMime(batch.fileName),
      originalName: req.file.originalname || batch.fileName,
    });

    return ok(res, { batchId: batch._id }, "Uploaded to S3");
  } catch (e) {
    next(e);
  }
};

/** POST /api/bank/uploads/complete — Step 2: file is on S3, start processing */
module.exports.completeBankUpload = async (req, res, next) => {
  try {
    const { batchId } = req.body;
    const bankId = req.user.bankId;

    const batch = await BankUploadBatch.findOne({ _id: batchId, bankId });
    if (!batch) return fail(res, 404, "Batch not found");
    if (!batch.storedFilePath) return fail(res, 400, "S3 key missing — presign again");

    const jobPayload = {
      batchId: batch._id,
      bankId,
      uploadedBy: req.user.userId,
      s3Key: batch.storedFilePath,
      fileName: batch.fileName,
      // flag so worker knows it's a bank job
      jobType: "bank_records",
    };

    // Try BullMQ queue first, fall back to setImmediate
    let queued = false;
    if (isUploadQueueEnabled()) {
      try {
        const result = await enqueueUploadJob(jobPayload);
        if (result?.queued) {
          batch.queueJobId = String(result.jobId);
          await batch.save();
          queued = true;
        }
      } catch {/* fall through */}
    }

    if (!queued) {
      setImmediate(async () => {
        try {
          await processBankUploadJob(jobPayload);
        } catch (err) {
          console.error("[BankUpload] Background job error:", err.message);
          const b = await BankUploadBatch.findById(batchId);
          if (b) { b.status = "failed"; b.errorMessage = err.message; await b.save(); }
        }
      });
    }

    return ok(res, { batchId: batch._id, queued }, "Processing started");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/uploads — list upload history for this bank user */
module.exports.listBankUploads = async (req, res, next) => {
  try {
    const bankId = req.user.bankId;
    const { role, userId } = req.user;

    const filter = { bankId };
    if (role === "BANK_PERSON") filter.uploadedBy = userId;

    const batches = await BankUploadBatch.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("uploadedBy", "name email");

    return ok(res, { batches }, "Upload history");
  } catch (e) {
    next(e);
  }
};

/** GET /api/bank/uploads/:batchId — poll status of a specific batch */
module.exports.getBankUploadBatch = async (req, res, next) => {
  try {
    const batch = await BankUploadBatch.findOne({
      _id: req.params.batchId,
      bankId: req.user.bankId,
    }).populate("uploadedBy", "name email");

    if (!batch) return fail(res, 404, "Batch not found");
    if (req.user.role === "BANK_PERSON" && !canManageUploadBatch(req, batch)) {
      return fail(res, 403, "Access denied");
    }
    return ok(res, { batch }, "Batch status");
  } catch (e) {
    next(e);
  }
};

function canManageBankRecord(req, record) {
  const bankId = String(req.user.bankId || "");
  const recordBankId = String(record.bankId?._id || record.bankId || "");
  if (recordBankId !== bankId) return false;
  if (req.user.role === "BANK_ADMIN") return true;
  if (req.user.role === "BANK_PERSON") {
    return String(record.uploadedBy?._id || record.uploadedBy) === String(req.user.userId);
  }
  return false;
}

function canManageUploadBatch(req, batch) {
  const bankId = String(req.user.bankId || "");
  if (String(batch.bankId?._id || batch.bankId) !== bankId) return false;
  if (req.user.role === "BANK_ADMIN") return true;
  if (req.user.role === "BANK_PERSON") {
    return String(batch.uploadedBy?._id || batch.uploadedBy) === String(req.user.userId);
  }
  return false;
}

/** DELETE /api/bank/records/:id — delete one record (own rows for bank person) */
module.exports.deleteRecord = async (req, res, next) => {
  try {
    const record = await BankRecord.findById(req.params.id);
    if (!record) return fail(res, 404, "Record not found");
    if (!canManageBankRecord(req, record)) {
      return fail(res, 403, "You can only delete records you uploaded");
    }

    await DataUsageLog.deleteMany({ bankRecordId: record._id });
    await record.deleteOne();

    return ok(
      res,
      { deleted: 1 },
      "Record deleted — removed from all linked agencies"
    );
  } catch (e) {
    next(e);
  }
};

/** DELETE /api/bank/uploads/:batchId/records — delete upload file + all imported rows (repo/agency lose access) */
module.exports.deleteBatchRecords = async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const bankId = req.user.bankId;

    const batch = await BankUploadBatch.findById(batchId);
    if (!batch || String(batch.bankId) !== String(bankId)) {
      return fail(res, 404, "Upload not found");
    }
    if (!canManageUploadBatch(req, batch)) {
      return fail(res, 403, "You can only delete your own uploads");
    }

    const restrictToUploader = req.user.role === "BANK_PERSON";

    const { deletedRecords, deletedLogs, batchRemoved } = await deleteBankUploadAndRecords(
      batch,
      { removeBatch: true, restrictToUploader }
    );

    return ok(
      res,
      {
        deleted: deletedRecords,
        deletedLogs,
        batchRemoved,
      },
      deletedRecords > 0
        ? `${deletedRecords} record(s) deleted — removed from all linked agencies`
        : "Upload file removed"
    );
  } catch (e) {
    next(e);
  }
};
