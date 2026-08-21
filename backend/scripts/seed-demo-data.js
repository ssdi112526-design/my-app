#!/usr/bin/env node
/**
 * Insert 10 interconnected demo records per Fast Recovery entity.
 * Does not delete or overwrite existing production/admin users.
 *
 *   node -r ./src/db/mongooseAlias.js scripts/seed-demo-data.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { hashPassword, comparePassword } = require("../src/utils/hash");

const User = require("../src/modules/users/user.model");
const Company = require("../src/modules/companies/company.model");
const Plan = require("../src/modules/plans/plan.model");
const Subscription = require("../src/modules/subscriptions/subscription.model");
const Payment = require("../src/modules/payments/payment.model");
const RepoCase = require("../src/modules/repoCases/repoCase.model");
const UploadBatch = require("../src/modules/uploads/uploadBatch.model");
const Confirmation = require("../src/modules/confirmations/confirmation.model");
const Bank = require("../src/modules/bank/bank.model");
const BankRecord = require("../src/modules/bank/bankRecord.model");
const BankRepoLink = require("../src/modules/bank/bankRepoLink.model");
const BankUploadBatch = require("../src/modules/bank/bankUploadBatch.model");
const PendingBankInvite = require("../src/modules/bank/pendingBankInvite.model");
const DataUsageLog = require("../src/modules/bank/dataUsageLog.model");
const Notification = require("../src/modules/notifications/notification.model");
const BlacklistEntry = require("../src/modules/blacklist/blacklist.model");
const Feedback = require("../src/modules/feedbacks/feedback.model");
const FinanceEntry = require("../src/modules/finances/financeEntry.model");
const OtpLog = require("../src/modules/otpLogs/otpLog.model");
const AuditLog = require("../src/modules/auditLogs/auditLog.model");
const LocationSnapshot = require("../src/modules/locationSnapshots/locationSnapshot.model");
const CompanyBank = require("../src/modules/companyBanks/companyBank.model");
const UserPhoneOtp = require("../src/modules/repoUsers/userPhoneOtp.model");
const VehicleLoadedNote = require("../src/modules/repoCases/vehicleLoadedNote.model");
const PendingRepoAdminPhoneOtp = require("../src/modules/companies/pendingRepoAdminPhoneOtp.model");

const PASSWORD = "Test@12345";
const N = 10;
const report = { created: {}, skipped: {}, errors: [] };

const CITIES = [
  ["New Delhi", "Delhi", "110001"],
  ["Mumbai", "Maharashtra", "400001"],
  ["Bengaluru", "Karnataka", "560001"],
  ["Hyderabad", "Telangana", "500001"],
  ["Chennai", "Tamil Nadu", "600001"],
  ["Pune", "Maharashtra", "411001"],
  ["Jaipur", "Rajasthan", "302001"],
  ["Ahmedabad", "Gujarat", "380001"],
  ["Kolkata", "West Bengal", "700001"],
  ["Lucknow", "Uttar Pradesh", "226001"],
];

const FIRST = [
  "Aarav", "Vihaan", "Aditya", "Kabir", "Ishaan",
  "Ananya", "Diya", "Meera", "Saanvi", "Kiara",
];
const LAST = [
  "Sharma", "Verma", "Patel", "Reddy", "Iyer",
  "Khan", "Nair", "Gupta", "Singh", "Joshi",
];

function pad(i) {
  return String(i + 1).padStart(2, "0");
}

function city(i) {
  return CITIES[i % CITIES.length];
}

function phone(offset, i) {
  return String(9000000000 + offset + i);
}

function idOf(doc) {
  return doc && (doc._id || doc.id);
}

async function upsert(Model, key, filter, doc) {
  try {
    const existing = await Model.findOne(filter).select("_id");
    if (existing) {
      report.skipped[key] = (report.skipped[key] || 0) + 1;
      return existing;
    }
    const created = await Model.create(doc);
    report.created[key] = (report.created[key] || 0) + 1;
    return created;
  } catch (err) {
    const msg = `${key}: ${err.message}`;
    report.errors.push(msg);
    console.error("Seed error:", msg);
    const fallback = await Model.findOne(filter).select("_id");
    return fallback;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  await connectDB(process.env.DATABASE_URL);
  const passwordHash = await hashPassword(PASSWORD);

  const ssdi = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `ssdi.admin.${n}@fastrecovery.test`;
    ssdi.push(
      await upsert(User, "SSDI_SUPER_ADMIN", { email }, {
        name: `Test Admin ${n}`,
        email,
        phone: phone(100, i),
        fatherName: `${LAST[i]} Ji`,
        address: `${10 + i}, Connaught Place`,
        city: city(i)[0],
        district: city(i)[0],
        state: city(i)[1],
        pincode: city(i)[2],
        passwordHash,
        role: "SSDI_SUPER_ADMIN",
        isActive: true,
        registrationSource: "ADMIN",
      })
    );
  }
  const creatorId = idOf(ssdi[0]);

  const plans = [];
  const durations = [1, 3, 6, 12, 1, 3, 6, 12, 1, 3];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const name = `Test Plan ${n}`;
    plans.push(
      await upsert(Plan, "Plan", { name }, {
        name,
        tierId: null,
        billingType: i % 2 === 0 ? "MONTHLY_FLAT" : "PER_CONNECT",
        durationMonths: durations[i],
        price: 1000 * (i + 1),
        monthlyPrice: 1000 * (i + 1),
        perConnectFee: i % 2 === 0 ? 0 : 150,
        maxUsers: 10 * (i + 1),
        currency: "INR",
        isActive: true,
      })
    );
  }

  const companies = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const companyCode = `TESTC${n}`;
    const loc = city(i);
    companies.push(
      await upsert(Company, "Company", { companyCode }, {
        companyCode,
        companyName: `Test Repo Company ${n}`,
        contactPersonName: `${FIRST[i]} ${LAST[i]}`,
        ownerName: `${FIRST[i]} ${LAST[i]}`,
        email: `company.${n}@fastrecovery.test`,
        phone: phone(200, i),
        address: `${20 + i}, Recovery Complex, ${loc[0]}`,
        gstNumber: `07AABCT${n}A1Z5`,
        panNumber: `AABCT${n}A`,
        aadhaarNumber: `23456789${n}`,
        status: "ACTIVE",
        registrationSource: "ADMIN",
        paymentStatus: "PAID",
        paymentMethod: "OFFLINE",
        paymentNote: "Demo seed",
        paymentMarkedAt: new Date(),
        createdBy: creatorId,
      })
    );
  }

  const repoAdmins = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `repo.admin.${n}@fastrecovery.test`;
    const loc = city(i);
    const admin = await upsert(User, "REPO_ADMIN", { email }, {
      name: `Test Repo Admin ${n}`,
      email,
      phone: phone(300, i),
      fatherName: `Ramesh ${LAST[i]}`,
      address: `${30 + i}, Agency Street`,
      city: loc[0],
      district: loc[0],
      state: loc[1],
      pincode: loc[2],
      agencyName: `Test Repo Company ${n}`,
      dateOfBirth: `198${i % 10}-0${(i % 9) + 1}-15`,
      bloodGroup: ["A+", "B+", "O+", "AB+", "A-"][i % 5],
      employeeNumber: `RA-${n}`,
      passwordHash,
      role: "REPO_ADMIN",
      companyId: idOf(companies[i]),
      isActive: true,
      registrationSource: "ADMIN",
    });
    repoAdmins.push(admin);
    const company = await Company.findById(idOf(companies[i]));
    if (company && !company.repoAdminUserId) {
      company.repoAdminUserId = idOf(admin);
      await company.save();
    }
  }

  async function staffRole(role, key, emailPrefix, phoneOff, title) {
    const list = [];
    for (let i = 0; i < N; i += 1) {
      const n = pad(i);
      const email = `${emailPrefix}.${n}@fastrecovery.test`;
      const loc = city(i);
      list.push(
        await upsert(User, key, { email }, {
          name: `Test ${title} ${n}`,
          email,
          phone: phone(phoneOff, i),
          fatherName: `Suresh ${LAST[i]}`,
          address: `${40 + i}, Staff Colony`,
          city: loc[0],
          district: loc[0],
          state: loc[1],
          pincode: loc[2],
          agencyName: `Test Repo Company ${n}`,
          employeeNumber: `${key.slice(0, 2)}-${n}`,
          passwordHash,
          role,
          companyId: idOf(companies[i]),
          teamLeaderId: role === "REPO_STAFF" ? idOf(list[0]) : null,
          isActive: true,
          registrationSource: "ADMIN",
        })
      );
    }
    return list;
  }

  const teamLeaders = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `team.leader.${n}@fastrecovery.test`;
    const loc = city(i);
    teamLeaders.push(
      await upsert(User, "TEAM_LEADER", { email }, {
        name: `Test Team Leader ${n}`,
        email,
        phone: phone(400, i),
        fatherName: `Mahesh ${LAST[i]}`,
        address: `${50 + i}, Leader Road`,
        city: loc[0],
        state: loc[1],
        pincode: loc[2],
        employeeNumber: `TL-${n}`,
        passwordHash,
        role: "TEAM_LEADER",
        companyId: idOf(companies[i]),
        isActive: true,
        registrationSource: "ADMIN",
      })
    );
  }

  const headOffice = await staffRole(
    "HEAD_OFFICE_STAFF",
    "HEAD_OFFICE_STAFF",
    "head.office",
    500,
    "Head Office Staff"
  );
  const officeStaff = await staffRole(
    "OFFICE_STAFF",
    "OFFICE_STAFF",
    "office.staff",
    600,
    "Office Staff"
  );

  const fieldAgents = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `field.agent.${n}@fastrecovery.test`;
    const loc = city(i);
    fieldAgents.push(
      await upsert(User, "REPO_STAFF", { email }, {
        name: `Test Field Agent ${n}`,
        email,
        phone: phone(700, i),
        fatherName: `Dinesh ${LAST[i]}`,
        address: `${60 + i}, Field Camp`,
        city: loc[0],
        district: loc[0],
        state: loc[1],
        pincode: loc[2],
        agencyName: `Test Repo Company ${n}`,
        dateOfBirth: `199${i % 10}-06-12`,
        bloodGroup: "O+",
        employeeNumber: `FA-${n}`,
        passwordHash,
        role: "REPO_STAFF",
        companyId: idOf(companies[i]),
        teamLeaderId: idOf(teamLeaders[i]),
        isActive: true,
        registrationSource: "ADMIN",
        lastKnownLocation: {
          latitude: 28.61 + i * 0.01,
          longitude: 77.2 + i * 0.01,
          accuracy: 12,
          updatedAt: new Date(),
          vehicleNumber: `DL01TE${pad(i)}`,
        },
      })
    );
  }

  const viewers = await staffRole(
    "REPO_VIEWER",
    "REPO_VIEWER",
    "repo.viewer",
    800,
    "Repo Viewer"
  );

  const banks = [];
  const BANK_NAMES = [
    "Test HDFC Financier",
    "Test ICICI Auto Finance",
    "Test SBI Vehicle Loan",
    "Test Axis Motor Finance",
    "Test Kotak Prime",
    "Test Bajaj Finserv Demo",
    "Test Mahindra Finance Demo",
    "Test Tata Capital Demo",
    "Test Cholamandalam Demo",
    "Test Sundaram Finance Demo",
  ];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const bankCode = `TESTB${n}`;
    const loc = city(i);
    banks.push(
      await upsert(Bank, "Bank", { bankCode }, {
        bankName: BANK_NAMES[i],
        bankCode,
        email: `bank.${n}@fastrecovery.test`,
        phone: phone(900, i),
        address: `${70 + i}, Finance Tower, ${loc[0]}`,
        city: loc[0],
        state: loc[1],
        gstNumber: `27AABCB${n}B1Z2`,
        panNumber: `AABCB${n}B`,
        branchName: `${loc[0]} Main Branch`,
        status: "active",
        registrationSource: "ADMIN",
        createdBy: creatorId,
        activatedAt: new Date(),
        lastPaymentAt: new Date(),
        paymentNote: "Demo seed activation",
      })
    );
  }

  const bankAdmins = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `bank.admin.${n}@fastrecovery.test`;
    const loc = city(i);
    const admin = await upsert(User, "BANK_ADMIN", { email }, {
      name: `Test Bank Admin ${n}`,
      email,
      phone: phone(1000, i),
      address: `${80 + i}, Bank Colony`,
      city: loc[0],
      state: loc[1],
      pincode: loc[2],
      branchName: `${loc[0]} Main Branch`,
      employeeNumber: `BA-${n}`,
      passwordHash,
      role: "BANK_ADMIN",
      bankId: idOf(banks[i]),
      isActive: true,
      registrationSource: "ADMIN",
    });
    bankAdmins.push(admin);
    const bank = await Bank.findById(idOf(banks[i]));
    if (bank && !bank.adminUserId) {
      bank.adminUserId = idOf(admin);
      await bank.save();
    }
  }

  const bankPersons = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const email = `bank.user.${n}@fastrecovery.test`;
    const loc = city(i);
    bankPersons.push(
      await upsert(User, "BANK_PERSON", { email }, {
        name: `Test Bank User ${n}`,
        email,
        phone: phone(1100, i),
        address: `${90 + i}, Credit Desk`,
        city: loc[0],
        state: loc[1],
        pincode: loc[2],
        branchName: `${loc[0]} Main Branch`,
        employeeNumber: `BP-${n}`,
        passwordHash,
        role: "BANK_PERSON",
        bankId: idOf(banks[i]),
        isActive: true,
        registrationSource: "ADMIN",
      })
    );
  }

  const subscriptions = [];
  for (let i = 0; i < N; i += 1) {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 12);
    subscriptions.push(
      await upsert(
        Subscription,
        "Subscription",
        { companyId: idOf(companies[i]), planId: idOf(plans[i]) },
        {
          companyId: idOf(companies[i]),
          planId: idOf(plans[i]),
          startDate: start,
          endDate: end,
          tierId: "silver",
          status: "ACTIVE",
          paymentStatus: "PAID",
        }
      )
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      Payment,
      "Payment",
      { razorpayOrderId: `order_seed_${n}` },
      {
        companyId: idOf(companies[i]),
        subscriptionId: idOf(subscriptions[i]),
        provider: "RAZORPAY",
        razorpayOrderId: `order_seed_${n}`,
        razorpayPaymentId: `pay_seed_${n}`,
        amount: 1000 * (i + 1),
        currency: "INR",
        status: "SUCCESS",
        paidAt: new Date(),
        meta: { seed: true },
      }
    );
  }

  const batches = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    batches.push(
      await upsert(
        UploadBatch,
        "UploadBatch",
        { fileName: `test-vehicles-${n}.xlsx`, companyId: idOf(companies[i]) },
        {
          companyId: idOf(companies[i]),
          fileName: `test-vehicles-${n}.xlsx`,
          storedFilePath: `uploads/demo/test-vehicles-${n}.xlsx`,
          storageLocation: "s3",
          bankName: BANK_NAMES[i],
          branchName: `${city(i)[0]} Main Branch`,
          totalRows: 10,
          columnCount: 8,
          columnNames: ["Vehicle", "Chassis", "Customer", "Loan", "Mobile", "City", "EMI", "Due"],
          successRows: 10,
          uploadedBy: idOf(repoAdmins[i]),
          status: "completed",
          processedRows: 10,
          importMode: "full",
          importNote: "Demo seed batch",
        }
      )
    );
  }

  const STATUSES = [
    "NEW", "IN_PROGRESS", "FOLLOW_UP", "PENDING_CONFIRMATION", "RESOLVED",
    "REPOSSESSED", "CLOSED", "CANCELLED", "IN_PROGRESS", "NEW",
  ];
  const cases = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const loc = city(i);
    const caseCode = `TEST-CASE-${n}`;
    cases.push(
      await upsert(RepoCase, "RepoCase", { caseCode }, {
        companyId: idOf(companies[i]),
        caseCode,
        referenceNumber: `REF-SEED-${n}`,
        loanAccountNumber: `LN2026${n}001`,
        bankName: BANK_NAMES[i],
        branchName: `${loc[0]} Main Branch`,
        uploadBatchId: idOf(batches[i]),
        customerName: `${FIRST[i]} ${LAST[i]}`,
        fatherName: `Rajesh ${LAST[i]}`,
        mobileNumber: phone(1200, i),
        alternateMobileNumber: phone(1300, i),
        vehicleNumber: `DL01TE${n}`,
        chassisNumber: `MB1TESTCHASSIS${n}`,
        engineNumber: `ENTEST${n}000`,
        vehicleType: i % 2 === 0 ? "Car" : "Two Wheeler",
        vehicleModel: i % 2 === 0 ? "Swift" : "Activa",
        vehicleBrand: i % 2 === 0 ? "Maruti" : "Honda",
        registrationState: loc[1],
        addressLine1: `${100 + i}, Borrower Street`,
        city: loc[0],
        district: loc[0],
        state: loc[1],
        pincode: loc[2],
        emiAmount: 8500 + i * 100,
        dueAmount: 24000 + i * 500,
        totalOutstandingAmount: 125000 + i * 1000,
        assignedToUserId: idOf(fieldAgents[i]),
        bucket: `B${(i % 4) + 1}`,
        priority: ["LOW", "MEDIUM", "HIGH"][i % 3],
        repoStatus: STATUSES[i],
        otpStatus: ["NOT_SENT", "SENT", "VERIFIED"][i % 3],
        blacklistStatus: i === 9 ? "YES" : "NO",
        confirmationStatus: ["PENDING", "CONFIRMED", "REJECTED"][i % 3],
        fieldNotes: `Demo trace note for case ${n}`,
        loadedShort: "Household goods",
        loadedDetail: "Demo loaded cargo description for testing.",
        contactPerson1Name: `Banker ${FIRST[i]}`,
        contactPerson1Phone: phone(1400, i),
        bankNotifyEmail1: `notify.${n}@fastrecovery.test`,
        traceStatus: ["PENDING", "TRACING", "TRACED"][i % 3],
        lastKnownLocation: {
          latitude: 28.5 + i * 0.02,
          longitude: 77.1 + i * 0.02,
          accuracy: 8,
          updatedAt: new Date(),
          tracerId: idOf(fieldAgents[i]),
          tracerName: `Test Field Agent ${n}`,
        },
        caseTimeline: [
          {
            type: "CREATED",
            summary: "Demo case seeded",
            byUserId: idOf(repoAdmins[i]),
            byName: `Test Repo Admin ${n}`,
            at: new Date(),
          },
        ],
        remarks: [
          {
            text: `Initial remark for demo case ${n}`,
            addedBy: idOf(repoAdmins[i]),
            addedByName: `Test Repo Admin ${n}`,
            createdAt: new Date(),
          },
        ],
        createdBy: idOf(repoAdmins[i]),
        updatedBy: idOf(fieldAgents[i]),
        lastActionAt: new Date(),
      })
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      Confirmation,
      "Confirmation",
      { caseId: idOf(cases[i]), requestedBy: idOf(fieldAgents[i]) },
      {
        companyId: idOf(companies[i]),
        caseId: idOf(cases[i]),
        requestNote: `Vehicle traced near ${city(i)[0]} for demo case ${n}`,
        traceMode: i % 2 === 0 ? "ONLINE" : "OFFLINE",
        shareChannel: ["whatsapp", "email", "sms", "app"][i % 4],
        photos: [`https://example.invalid/demo/photo-${n}.jpg`],
        status: ["PENDING", "CONFIRMED", "REJECTED"][i % 3],
        requestedBy: idOf(fieldAgents[i]),
        requestedByName: `Test Field Agent ${n}`,
        requestedByRole: "REPO_STAFF",
        requestedByPhone: phone(700, i),
        reviewedBy: i % 3 !== 0 ? idOf(repoAdmins[i]) : null,
        reviewedAt: i % 3 !== 0 ? new Date() : null,
        reviewNote: i % 3 !== 0 ? "Demo review" : "",
        finalAction: i % 3 === 1 ? "IN_YARD" : null,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      CompanyBank,
      "CompanyBank",
      { companyId: idOf(companies[i]), bankName: BANK_NAMES[i] },
      {
        companyId: idOf(companies[i]),
        bankName: BANK_NAMES[i],
        isActive: true,
        branches: [
          {
            name: `${city(i)[0]} Main`,
            code: `BR${n}`,
            isActive: true,
            notifyEmail: `branch.${n}@fastrecovery.test`,
            notifyPhone: phone(1500, i),
          },
        ],
        createdBy: idOf(repoAdmins[i]),
        updatedBy: idOf(repoAdmins[i]),
      }
    );
  }

  const bankRecords = [];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    bankRecords.push(
      await upsert(
        BankRecord,
        "BankRecord",
        { bankId: idOf(banks[i]), loanAccountNumber: `BANKLN${n}` },
        {
          bankId: idOf(banks[i]),
          uploadedBy: idOf(bankPersons[i]),
          batchId: `BANK-BATCH-${n}`,
          vehicleNumber: `MH12BK${n}`,
          chassisNumber: `BANKCHASSIS${n}`,
          engineNumber: `BANKENG${n}`,
          borrowerName: `${FIRST[i]} ${LAST[i]}`,
          borrowerPhone: phone(1600, i),
          borrowerAddress: `${110 + i}, Finance Nagar, ${city(i)[0]}`,
          loanAccountNumber: `BANKLN${n}`,
          loanAmount: 450000 + i * 10000,
          outstandingAmount: 180000 + i * 5000,
          vehicleMake: "Hyundai",
          vehicleModel: "i20",
          vehicleYear: "2021",
          branchName: `${city(i)[0]} Main Branch`,
          branchCode: `BR${n}`,
          extraFields: { seed: "true", bucket: "B2" },
          status: ["active", "assigned", "recovered", "closed"][i % 4],
        }
      )
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      BankUploadBatch,
      "BankUploadBatch",
      { fileName: `bank-upload-${n}.xlsx`, bankId: idOf(banks[i]) },
      {
        bankId: idOf(banks[i]),
        uploadedBy: idOf(bankPersons[i]),
        fileName: `bank-upload-${n}.xlsx`,
        storedFilePath: `uploads/bank/demo-${n}.xlsx`,
        status: "completed",
        totalRows: 10,
        processedRows: 10,
        successRows: 10,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    await upsert(
      BankRepoLink,
      "BankRepoLink",
      { bankPersonId: idOf(bankPersons[i]), repoAdminId: idOf(repoAdmins[i]) },
      {
        bankPersonId: idOf(bankPersons[i]),
        bankId: idOf(banks[i]),
        repoAdminId: idOf(repoAdmins[i]),
        linkedBy: creatorId,
        isActive: true,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      PendingBankInvite,
      "PendingBankInvite",
      { agencyEmail: `invite.agency.${n}@fastrecovery.test` },
      {
        bankPersonId: idOf(bankPersons[i]),
        bankId: idOf(banks[i]),
        agencyEmail: `invite.agency.${n}@fastrecovery.test`,
        agencyName: `Invite Agency ${n}`,
        token: `seed-invite-token-${n}-${Date.now().toString(16)}`.slice(0, 64),
        status: i < 7 ? "pending" : "accepted",
        createdBy: creatorId,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    await upsert(
      DataUsageLog,
      "DataUsageLog",
      { bankRecordId: idOf(bankRecords[i]), repoAdminId: idOf(repoAdmins[i]) },
      {
        bankRecordId: idOf(bankRecords[i]),
        uploadedBy: idOf(bankPersons[i]),
        bankId: idOf(banks[i]),
        repoAdminId: idOf(repoAdmins[i]),
        tracerId: idOf(fieldAgents[i]),
        status: ["active", "returned", "closed"][i % 3],
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      BlacklistEntry,
      "BlacklistEntry",
      { caseId: idOf(cases[i]), companyId: idOf(companies[i]) },
      {
        companyId: idOf(companies[i]),
        caseId: idOf(cases[i]),
        vehicleNumber: `DL01TE${n}`,
        chassisNumber: `MB1TESTCHASSIS${n}`,
        customerName: `${FIRST[i]} ${LAST[i]}`,
        reason: "Demo skip / hostile customer for testing",
        remarks: "Seeded blacklist row",
        status: i < 8 ? "ACTIVE" : "REMOVED",
        blacklistedBy: idOf(repoAdmins[i]),
        blacklistedAt: new Date(),
        removedBy: i >= 8 ? idOf(repoAdmins[i]) : null,
        removedAt: i >= 8 ? new Date() : null,
      }
    );
  }

  const FEEDBACK_CAT = ["BUG", "FEATURE_REQUEST", "SUPPORT", "GENERAL"];
  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      Feedback,
      "Feedback",
      { companyId: idOf(companies[i]), message: `Demo feedback ${n} from field operations.` },
      {
        companyId: idOf(companies[i]),
        userId: idOf(fieldAgents[i]),
        message: `Demo feedback ${n} from field operations.`,
        rating: (i % 5) + 1,
        subject: `Test feedback ${n}`,
        category: FEEDBACK_CAT[i % 4],
        status: ["OPEN", "IN_REVIEW", "RESOLVED"][i % 3],
      }
    );
  }

  const FIN_TYPES = ["COLLECTION", "EXPENSE", "FUEL", "AGENT_PAYMENT", "INCENTIVE", "OTHER"];
  for (let i = 0; i < N; i += 1) {
    await upsert(
      FinanceEntry,
      "FinanceEntry",
      { companyId: idOf(companies[i]), description: `Demo finance entry ${pad(i)}` },
      {
        companyId: idOf(companies[i]),
        caseId: idOf(cases[i]),
        type: FIN_TYPES[i % FIN_TYPES.length],
        amount: 500 + i * 250,
        description: `Demo finance entry ${pad(i)}`,
        entryDate: new Date(),
        createdBy: idOf(repoAdmins[i]),
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    await upsert(
      OtpLog,
      "OtpLog",
      { caseId: idOf(cases[i]), mobileNumber: phone(1200, i) },
      {
        companyId: idOf(companies[i]),
        caseId: idOf(cases[i]),
        mobileNumber: phone(1200, i),
        otpCode: `12${pad(i)}56`,
        status: ["SENT", "VERIFIED", "FAILED", "EXPIRED"][i % 4],
        provider: "MANUAL",
        remarks: "Demo OTP log",
        createdBy: idOf(fieldAgents[i]),
        sentAt: new Date(),
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      Notification,
      "Notification",
      { userId: idOf(repoAdmins[i]), title: `Demo notification ${n}` },
      {
        companyId: idOf(companies[i]),
        userId: idOf(repoAdmins[i]),
        type: "RECORD_UPLOAD",
        title: `Demo notification ${n}`,
        message: `Test upload completed for company ${n}`,
        meta: { seed: true },
        isRead: i % 2 === 0,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      AuditLog,
      "AuditLog",
      { action: "SEED_DEMO", entityId: idOf(cases[i]) },
      {
        companyId: idOf(companies[i]),
        userId: idOf(repoAdmins[i]),
        userName: `Test Repo Admin ${n}`,
        role: "REPO_ADMIN",
        action: "SEED_DEMO",
        entity: "RepoCase",
        entityId: idOf(cases[i]),
        meta: { source: "seed-demo-data" },
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    await upsert(
      LocationSnapshot,
      "LocationSnapshot",
      { caseId: idOf(cases[i]), tracerId: idOf(fieldAgents[i]) },
      {
        companyId: idOf(companies[i]),
        caseId: idOf(cases[i]),
        tracerId: idOf(fieldAgents[i]),
        tracerName: `Test Field Agent ${n}`,
        latitude: 28.5355 + i * 0.01,
        longitude: 77.391 + i * 0.01,
        accuracy: 10,
        heading: 90,
        speed: 12,
        source: i % 2 === 0 ? "GPS" : "MANUAL",
        note: `Demo GPS ping ${n}`,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    const n = pad(i);
    const lookupKey = `DL01TE${n}`;
    await upsert(
      VehicleLoadedNote,
      "VehicleLoadedNote",
      { companyId: idOf(companies[i]), lookupKey },
      {
        companyId: idOf(companies[i]),
        lookupKey,
        vehicleNumber: lookupKey,
        chassisNumber: `MB1TESTCHASSIS${n}`,
        loadedShort: "Household",
        loadedDetail: "Demo loaded note for find-vehicles overlay.",
        updatedBy: idOf(fieldAgents[i]),
        updatedByName: `Test Field Agent ${n}`,
      }
    );
  }

  const otpHash = await hashPassword("123456");
  for (let i = 0; i < N; i += 1) {
    await upsert(
      UserPhoneOtp,
      "UserPhoneOtp",
      { phone: phone(300, i), companyId: idOf(companies[i]) },
      {
        phone: phone(300, i),
        companyId: idOf(companies[i]),
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        status: i % 2 === 0 ? "PENDING" : "VERIFIED",
        verifiedAt: i % 2 === 0 ? null : new Date(),
        createdBy: creatorId,
      }
    );
  }

  for (let i = 0; i < N; i += 1) {
    await upsert(
      PendingRepoAdminPhoneOtp,
      "PendingRepoAdminPhoneOtp",
      { phone: phone(1700, i), createdBy: creatorId },
      {
        phone: phone(1700, i),
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        status: "PENDING",
        createdBy: creatorId,
      }
    );
  }

  const sample = await User.findOne({ email: "repo.admin.01@fastrecovery.test" }).select(
    "+passwordHash"
  );
  const passwordOk = sample
    ? await comparePassword(PASSWORD, sample.passwordHash)
    : false;

  const productionAdmin = await User.findOne({ email: "admin@ssdi.com" }).select("email role");
  const roles = [
    "SSDI_SUPER_ADMIN",
    "REPO_ADMIN",
    "TEAM_LEADER",
    "HEAD_OFFICE_STAFF",
    "OFFICE_STAFF",
    "REPO_STAFF",
    "REPO_VIEWER",
    "BANK_ADMIN",
    "BANK_PERSON",
  ];
  const roleCounts = {};
  for (const role of roles) {
    roleCounts[role] = await User.countDocuments({
      role,
      email: { $regex: "@fastrecovery\\.test$" },
    });
  }

  const counts = {
    users: await User.countDocuments(),
    demoUsers: await User.countDocuments({ email: { $regex: "@fastrecovery\\.test$" } }),
    companies: await Company.countDocuments({ companyCode: { $regex: "^TESTC" } }),
    banks: await Bank.countDocuments({ bankCode: { $regex: "^TESTB" } }),
    plans: await Plan.countDocuments({ name: { $regex: "^Test Plan " } }),
    cases: await RepoCase.countDocuments({ caseCode: { $regex: "^TEST-CASE-" } }),
    confirmations: await Confirmation.countDocuments(),
    subscriptions: await Subscription.countDocuments(),
    payments: await Payment.countDocuments({ razorpayOrderId: { $regex: "^order_seed_" } }),
  };

  console.log("\n=== Seed report ===");
  console.log("Created this run:", report.created);
  console.log("Skipped (already present):", report.skipped);
  if (report.errors.length) console.log("Errors:", report.errors);
  console.log("Demo users by role:", roleCounts);
  console.log("Demo entity counts:", counts);
  console.log("Existing admin@ssdi.com intact:", Boolean(productionAdmin));
  console.log("Password verify (repo.admin.01):", passwordOk);
  console.log("\nShared password for all @fastrecovery.test accounts:", PASSWORD);
  console.log("Sample logins:");
  console.log("  Platform Admin  /ssdi/login        ssdi.admin.01@fastrecovery.test");
  console.log("  Repo Admin      /repo-admin/login  repo.admin.01@fastrecovery.test");
  console.log("  Field Agent     /repo-agent/login  field.agent.01@fastrecovery.test");
  console.log("  Bank User       /bank/login        bank.admin.01@fastrecovery.test");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
