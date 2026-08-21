#!/usr/bin/env node
/**
 * Insert 100 demo repo companies (TESTC001–TESTC100) with linked repo admins.
 * Does not delete or overwrite existing companies/users.
 *
 *   node -r ./src/db/mongooseAlias.js scripts/seed-100-companies.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { hashPassword } = require("../src/utils/hash");

const User = require("../src/modules/users/user.model");
const Company = require("../src/modules/companies/company.model");
const Plan = require("../src/modules/plans/plan.model");
const Subscription = require("../src/modules/subscriptions/subscription.model");

const PASSWORD = "Test@12345";
const N = 100;

const AGENCY_NAMES = [
  "Secure Asset Recovery Services",
  "National Vehicle Recovery Solutions",
  "Prime Recovery Associates",
  "Bharat Asset Repossession Services",
  "Rapid Recovery Network",
  "Trustline Recovery Services",
  "SecureTrack Repossession Agency",
  "Capital Recovery Associates",
  "Apex Vehicle Recovery Services",
  "Sentinel Asset Repossession Services",
  "Shield Line Collection Services",
  "Horizon Financial Recovery",
  "Pioneer Asset Management",
  "Unity Field Recovery Services",
  "Vanguard Auto Repossession Services",
  "Metro Vehicle Recovery Associates",
  "Continental Asset Recovery Services",
  "Heritage Loan Collection Services",
  "Falcon Repossession Services",
  "Eagle Eye Vehicle Recovery",
  "Titan Collateral Recovery Services",
  "Vertex Financial Recovery Associates",
  "Summit Asset Repossession Services",
  "Compass Collection Services",
  "Anchor NBFC Recovery Services",
  "Lotus Asset Recovery Associates",
  "Ganga Vehicle Recovery Services",
  "Deccan Repossession Services",
  "Himalaya Asset Management",
  "Coastal Auto Recovery Services",
  "Peninsula Financial Recovery",
  "Golden Shield Recovery Associates",
  "Silverline Asset Recovery Services",
  "Ironclad Repossession Services",
  "Steel City Vehicle Recovery",
  "Diamond Asset Collection Services",
  "Royal Capital Recovery Services",
  "Crown Field Recovery Associates",
  "Elite Auto Repossession Services",
  "Premier Loan Recovery Network",
  "Pan India Asset Recovery Services",
  "All India Vehicle Repossession",
  "North Star Recovery Associates",
  "Southland Asset Recovery Services",
  "Eastern Fleet Recovery Services",
  "Western Range Collection Services",
  "IndoTrust Recovery Associates",
  "Sagar Asset Repossession Services",
  "Trident Vehicle Recovery Services",
  "Phoenix Financial Recovery",
  "Nimbus Collection Associates",
  "Zenith Asset Recovery Services",
  "Omega Repossession Network",
  "Alpha Field Recovery Services",
  "Delta Motor Recovery Associates",
  "Sterling Asset Management Services",
  "Beacon Loan Recovery Services",
  "Fortress Collateral Recovery",
  "Guardian Vehicle Repossession Services",
  "Marshal Field Collection Services",
  "Paladin Asset Recovery Associates",
  "Citadel Financial Recovery Services",
  "Keystone Repossession Associates",
  "Landmark Vehicle Recovery Services",
  "Pathway Asset Collection Services",
  "Bridgeway Recovery Associates",
  "Skyline Auto Recovery Services",
  "Evergreen Asset Recovery Network",
  "BlueChip Financial Recovery",
  "TrueNorth Repossession Services",
  "FairDeal Collection Associates",
  "Swift Track Vehicle Recovery",
  "Lightning Asset Recovery Services",
  "Ridgeway Repossession Associates",
  "Valley Field Recovery Services",
  "Plateau Asset Management",
  "Sahara Auto Recovery Services",
  "Oceanic Vehicle Repossession",
  "Riverbank Collection Services",
  "Pearl Asset Recovery Associates",
  "Ruby Line Financial Recovery",
  "Sapphire Vehicle Recovery Services",
  "Emerald Collateral Recovery",
  "Jade Field Collection Services",
  "Onyx Asset Repossession Services",
  "Granite Recovery Associates",
  "Marble City Vehicle Recovery",
  "Copperline Asset Recovery Services",
  "Bronze Shield Collection Services",
  "Platinum Financial Recovery",
  "Quantum Asset Repossession Services",
  "Nexus Vehicle Recovery Network",
  "Axis Field Recovery Associates",
  "Vector Auto Repossession Services",
  "Pulse Loan Collection Services",
  "Core Asset Recovery Services",
  "SafeHarbor Repossession Associates",
  "PrimeLine Vehicle Recovery Services",
  "RedFort Asset Recovery Services",
  "Nalanda Financial Recovery",
];

const CITIES = [
  ["New Delhi", "Delhi", "110001", "07"],
  ["Mumbai", "Maharashtra", "400001", "27"],
  ["Bengaluru", "Karnataka", "560001", "29"],
  ["Hyderabad", "Telangana", "500001", "36"],
  ["Chennai", "Tamil Nadu", "600001", "33"],
  ["Pune", "Maharashtra", "411001", "27"],
  ["Jaipur", "Rajasthan", "302001", "08"],
  ["Ahmedabad", "Gujarat", "380001", "24"],
  ["Kolkata", "West Bengal", "700001", "19"],
  ["Lucknow", "Uttar Pradesh", "226001", "09"],
  ["Chandigarh", "Chandigarh", "160001", "04"],
  ["Kochi", "Kerala", "682001", "32"],
  ["Indore", "Madhya Pradesh", "452001", "23"],
  ["Nagpur", "Maharashtra", "440001", "27"],
  ["Surat", "Gujarat", "395001", "24"],
  ["Bhopal", "Madhya Pradesh", "462001", "23"],
  ["Patna", "Bihar", "800001", "10"],
  ["Bhubaneswar", "Odisha", "751001", "21"],
  ["Coimbatore", "Tamil Nadu", "641001", "33"],
  ["Visakhapatnam", "Andhra Pradesh", "530001", "37"],
  ["Guwahati", "Assam", "781001", "18"],
  ["Ranchi", "Jharkhand", "834001", "20"],
  ["Raipur", "Chhattisgarh", "492001", "22"],
  ["Ludhiana", "Punjab", "141001", "03"],
  ["Vadodara", "Gujarat", "390001", "24"],
];

/** 1-based indexes — scattered, not clustered at the end. */
const INACTIVE_INDEXES = new Set([7, 14, 23, 31, 42, 56, 68, 77, 89, 94]);

function pad(n) {
  return String(n).padStart(3, "0");
}

function firstConfirmation(n) {
  return String(9000000100 + n);
}

function secondConfirmation(n) {
  return String(9876500100 + n);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  if (AGENCY_NAMES.length !== N) {
    console.error(`Expected ${N} agency names, got ${AGENCY_NAMES.length}`);
    process.exit(1);
  }
  if (new Set(AGENCY_NAMES).size !== N) {
    console.error("Agency names are not unique");
    process.exit(1);
  }
  if (INACTIVE_INDEXES.size !== 10) {
    console.error("Need exactly 10 INACTIVE indexes");
    process.exit(1);
  }

  await connectDB(process.env.DATABASE_URL);
  const passwordHash = await hashPassword(PASSWORD);

  const creator =
    (await User.findOne({ email: "admin@ssdi.com" })) ||
    (await User.findOne({ role: "SSDI_SUPER_ADMIN" }));
  const creatorId = creator && (creator._id || creator.id);

  const plan = await Plan.findOne({ isActive: true }).sort({ durationMonths: -1 });

  const rows = [];
  let createdCompanies = 0;
  let createdAdmins = 0;
  let skippedCompanies = 0;
  let skippedAdmins = 0;
  const errors = [];

  for (let n = 1; n <= N; n += 1) {
    const code = `TESTC${pad(n)}`;
    const email = `company.${pad(n)}@fastrecovery.test`;
    const adminEmail = `repo.admin.${pad(n)}@fastrecovery.test`;
    const name = AGENCY_NAMES[n - 1];
    const phone = firstConfirmation(n);
    const adminPhone = secondConfirmation(n);
    const status = INACTIVE_INDEXES.has(n) ? "INACTIVE" : "ACTIVE";
    const loc = CITIES[(n - 1) % CITIES.length];
    const pan = `AABCR${String(n).padStart(4, "0")}F`;
    const gst = `${loc[3]}${pan}1Z5`;

    let company = await Company.findOne({ companyCode: code });
    if (company) {
      skippedCompanies += 1;
    } else {
      try {
        company = await Company.create({
          companyCode: code,
          companyName: name,
          contactPersonName: `Agency Desk ${pad(n)}`,
          ownerName: `Agency Owner ${pad(n)}`,
          email,
          phone,
          address: `${100 + n}, Recovery Complex, ${loc[0]}`,
          gstNumber: gst,
          panNumber: pan,
          aadhaarNumber: `23456789${String(n).padStart(4, "0")}`.slice(0, 12),
          status,
          registrationSource: "ADMIN",
          paymentStatus: "PAID",
          paymentMethod: "OFFLINE",
          paymentNote: "Demo seed — 100 companies",
          paymentMarkedAt: new Date(),
          blockReason: status === "INACTIVE" ? "Demo seed — inactive agency" : null,
          blockedAt: status === "INACTIVE" ? new Date() : null,
          createdBy: creatorId,
        });
        createdCompanies += 1;
      } catch (err) {
        errors.push(`${code}: ${err.message}`);
        company = await Company.findOne({ companyCode: code });
      }
    }

    let admin = await User.findOne({ email: adminEmail });
    if (admin) {
      skippedAdmins += 1;
    } else if (company) {
      try {
        admin = await User.create({
          name: `Repo Admin ${pad(n)}`,
          email: adminEmail,
          phone: adminPhone,
          address: `${200 + n}, Agency Street, ${loc[0]}`,
          city: loc[0],
          district: loc[0],
          state: loc[1],
          pincode: loc[2],
          agencyName: name,
          employeeNumber: `RA-${pad(n)}`,
          passwordHash,
          role: "REPO_ADMIN",
          companyId: company._id,
          isActive: status === "ACTIVE",
          registrationSource: "ADMIN",
        });
        createdAdmins += 1;
      } catch (err) {
        errors.push(`${adminEmail}: ${err.message}`);
        admin = await User.findOne({ email: adminEmail });
      }
    }

    if (company && admin && !company.repoAdminUserId) {
      company.repoAdminUserId = admin._id;
      await company.save();
    }

    if (company && plan) {
      const existingSub = await Subscription.findOne({
        companyId: company._id,
        planId: plan._id,
      });
      if (!existingSub) {
        const start = new Date();
        const end = new Date();
        end.setMonth(end.getMonth() + 12);
        await Subscription.create({
          companyId: company._id,
          planId: plan._id,
          startDate: start,
          endDate: end,
          tierId: plan.tierId || "silver",
          status: status === "ACTIVE" ? "ACTIVE" : "CANCELLED",
          paymentStatus: "PAID",
        });
      }
    }

    rows.push({
      code,
      name,
      email,
      phone,
      status,
      adminEmail,
    });
  }

  const seeded = await Company.find({ companyCode: { $regex: "^TESTC\\d{3}$" } })
    .select("companyCode companyName email phone status repoAdminUserId")
    .populate("repoAdminUserId", "email phone")
    .sort({ companyCode: 1 });

  const codes = seeded.map((c) => c.companyCode);
  const names = seeded.map((c) => c.companyName);
  const emails = seeded.map((c) => c.email);
  const phones = seeded.map((c) => c.phone);
  const adminEmails = seeded.map((c) => c.repoAdminUserId?.email).filter(Boolean);
  const unique = (arr) => new Set(arr).size === arr.length;

  const activeCount = seeded.filter((c) => c.status === "ACTIVE").length;
  const inactiveCount = seeded.filter((c) => c.status === "INACTIVE").length;

  console.log("\n=== 100 repo companies seed ===");
  console.log("Created companies:", createdCompanies, "| skipped:", skippedCompanies);
  console.log("Created repo admins:", createdAdmins, "| skipped:", skippedAdmins);
  if (errors.length) console.log("Errors:", errors);

  console.log("\nVerification:");
  console.log("  Count:", seeded.length);
  console.log("  Unique codes:", unique(codes), `(${codes.length})`);
  console.log("  Unique names:", unique(names), `(${names.length})`);
  console.log("  Unique emails:", unique(emails), `(${emails.length})`);
  console.log("  Unique first confirmation numbers:", unique(phones), `(${phones.length})`);
  console.log("  Unique repo admin emails:", unique(adminEmails), `(${adminEmails.length})`);
  console.log("  ACTIVE:", activeCount, "| INACTIVE:", inactiveCount);
  console.log("  Admins linked:", seeded.filter((c) => c.repoAdminUserId).length);
  console.log("  Shared password:", PASSWORD);

  console.log("\n| Code | Agency Name | Email | First Confirmation Number | Status | Repo Admin |");
  console.log("| ---- | ----------- | ----- | ------------------------- | ------ | ---------- |");
  for (const row of rows) {
    console.log(
      `| ${row.code} | ${row.name} | ${row.email} | ${row.phone} | ${row.status} | ${row.adminEmail} |`
    );
  }

  const ok =
    seeded.length === N &&
    unique(codes) &&
    unique(names) &&
    unique(emails) &&
    unique(phones) &&
    unique(adminEmails) &&
    adminEmails.length === N &&
    activeCount === 90 &&
    inactiveCount === 10 &&
    !errors.length;

  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
