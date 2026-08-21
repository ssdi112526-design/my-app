#!/usr/bin/env node
/**
 * Create 100 agents for each TESTC001–TESTC100 company (10,000 total).
 * Existing AG001–AG020 rows are skipped. Does not delete users.
 *
 *   node -r ./src/db/mongooseAlias.js scripts/seed-2000-agents.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const { hashPassword } = require("../src/utils/hash");
const User = require("../src/modules/users/user.model");
const Company = require("../src/modules/companies/company.model");

const PASSWORD = "Test@12345";
const AGENTS_PER_COMPANY = 100;
const PREVIOUS_AGENTS_PER_COMPANY = 20;
const COMPANY_COUNT = 100;

const FIRST = [
  "Rahul", "Amit", "Rohit", "Sandeep", "Vikas",
  "Ankit", "Deepak", "Manish", "Pankaj", "Naveen",
  "Rajesh", "Arjun", "Sunil", "Mohit", "Ajay",
  "Rakesh", "Sachin", "Nitin", "Akash", "Karan",
  "Vivek", "Gaurav", "Prakash", "Suresh", "Mahesh",
  "Dinesh", "Lokesh", "Yogesh", "Harish", "Naresh",
  "Priya", "Neha", "Pooja", "Anjali", "Kavita",
  "Sneha", "Meena", "Ritu", "Shweta", "Divya",
];

const LAST = [
  "Sharma", "Verma", "Kumar", "Yadav", "Singh",
  "Patel", "Reddy", "Iyer", "Nair", "Gupta",
  "Joshi", "Mehta", "Mishra", "Chauhan", "Thakur",
  "Pandey", "Jain", "Kapoor", "Malhotra", "Bhat",
  "Deshmukh", "Kulkarni", "Banerjee", "Chatterjee", "Das",
];

const AGENT_SPECS = [
  { role: "TEAM_LEADER", post: "Senior Recovery Agent" },
  { role: "TEAM_LEADER", post: "Senior Collection Officer" },
  { role: "HEAD_OFFICE_STAFF", post: "Asset Recovery Executive" },
  { role: "HEAD_OFFICE_STAFF", post: "Recovery Officer" },
  { role: "OFFICE_STAFF", post: "Collection Officer" },
  { role: "OFFICE_STAFF", post: "Collection Agent" },
  { role: "REPO_VIEWER", post: "Field Executive" },
  { role: "REPO_VIEWER", post: "Field Collection Executive" },
  { role: "REPO_STAFF", post: "Field Recovery Agent" },
  { role: "REPO_STAFF", post: "Vehicle Recovery Agent" },
  { role: "REPO_STAFF", post: "Collection Agent" },
  { role: "REPO_STAFF", post: "Field Recovery Agent" },
  { role: "REPO_STAFF", post: "Vehicle Recovery Agent" },
  { role: "REPO_STAFF", post: "Field Collection Executive" },
  { role: "REPO_STAFF", post: "Asset Recovery Executive" },
  { role: "REPO_STAFF", post: "Recovery Officer" },
  { role: "REPO_STAFF", post: "Field Recovery Agent" },
  { role: "REPO_STAFF", post: "Vehicle Recovery Agent" },
  { role: "REPO_STAFF", post: "Collection Agent" },
  { role: "REPO_STAFF", post: "Field Executive" },
];

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function pad(n, width = 3) {
  return String(n).padStart(width, "0");
}

function agentCode(companyCode, agentNo) {
  return `${companyCode}-AG${pad(agentNo)}`;
}

function agentEmail(companyNo, agentNo) {
  return `agent.${pad(companyNo)}.${pad(agentNo)}@fastrecovery.test`;
}

function specFor(agentNo) {
  return AGENT_SPECS[(agentNo - 1) % AGENT_SPECS.length];
}

function agentPhone(companyNo, agentNo) {
  if (agentNo <= PREVIOUS_AGENTS_PER_COMPANY) {
    return String(9700001000 + (companyNo - 1) * PREVIOUS_AGENTS_PER_COMPANY + agentNo);
  }
  return String(9710000000 + (companyNo - 1) * AGENTS_PER_COMPANY + agentNo);
}

function agentName(companyNo, agentNo, used) {
  for (let shift = 0; shift < FIRST.length * LAST.length; shift += 1) {
    const first = FIRST[(companyNo * 3 + agentNo + shift - 1) % FIRST.length];
    const last = LAST[(companyNo * 5 + agentNo * 2 + shift - 1) % LAST.length];
    const name = `${first} ${last}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  return `Demo Agent ${pad(companyNo)}-${pad(agentNo)}`;
}

function inactiveCountFor(companyNo) {
  return 8 + (companyNo % 8);
}

async function createInBatches(docs, size = 10) {
  const created = [];
  for (let i = 0; i < docs.length; i += size) {
    const chunk = docs.slice(i, i + size);
    const rows = await Promise.all(chunk.map((doc) => User.create(doc)));
    created.push(...rows);
  }
  return created;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  await connectDB(process.env.DATABASE_URL);
  const passwordHash = await hashPassword(PASSWORD);

  const companies = await Company.find({ companyCode: { $regex: "^TESTC\\d{3}$" } })
    .select("_id companyCode companyName address")
    .sort({ companyCode: 1 });

  if (companies.length !== COMPANY_COUNT) {
    console.error(`Expected ${COMPANY_COUNT} TESTC001–TESTC100 companies, found ${companies.length}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await User.find({
    email: { $regex: "^agent\\.\\d{3}\\.\\d{3}@fastrecovery\\.test$" },
  }).select("email name companyId");
  const existingEmails = new Set(existing.map((u) => u.email));
  const namesByCompany = new Map();
  for (const row of existing) {
    const key = String(row.companyId || "");
    if (!namesByCompany.has(key)) namesByCompany.set(key, new Set());
    if (row.name) namesByCompany.get(key).add(row.name);
  }

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let c = 1; c <= COMPANY_COUNT; c += 1) {
    const company = companies[c - 1];
    const expectedCode = `TESTC${pad(c)}`;
    if (company.companyCode !== expectedCode) {
      errors.push(`Company order mismatch at ${c}: ${company.companyCode}`);
      continue;
    }

    const usedNames = namesByCompany.get(String(company._id)) || new Set();
    const inactiveCount = inactiveCountFor(c);
    const leaderDocs = [];
    const staffDocs = [];

    for (let a = 1; a <= AGENTS_PER_COMPANY; a += 1) {
      const email = agentEmail(c, a);
      if (existingEmails.has(email)) {
        skipped += 1;
        continue;
      }
      const spec = specFor(a);
      const name = agentName(c, a, usedNames);
      const isActive = a > AGENTS_PER_COMPANY - inactiveCount ? false : true;
      const loc = String(company.address || "").split(",").pop()?.trim() || "New Delhi";
      const doc = {
        name,
        email,
        phone: agentPhone(c, a),
        fatherName: `${LAST[(c + a) % LAST.length]} Ji`,
        address: `${a}, Field Camp, ${loc}`,
        city: loc,
        district: loc,
        state: loc,
        pincode: "110001",
        agencyName: company.companyName,
        employeeNumber: agentCode(company.companyCode, a),
        post: spec.post,
        dateOfBirth: `198${a % 10}-0${(a % 9) + 1}-12`,
        bloodGroup: BLOOD[a % BLOOD.length],
        passwordHash,
        role: spec.role,
        companyId: company._id,
        isActive,
        registrationSource: "ADMIN",
      };
      if (spec.role === "REPO_STAFF") {
        doc.lastKnownLocation = {
          latitude: 28.5 + (c % 10) * 0.02 + a * 0.001,
          longitude: 77.1 + (c % 10) * 0.02 + a * 0.001,
          accuracy: 10,
          updatedAt: new Date(),
          vehicleNumber: `DL${pad(c, 2)}AG${pad(a, 2)}`.slice(0, 10),
        };
      }
      if (spec.role === "TEAM_LEADER") leaderDocs.push(doc);
      else staffDocs.push(doc);
    }

    try {
      const leaders = leaderDocs.length ? await createInBatches(leaderDocs, 2) : [];
      const leaderIds = leaders.map((u) => u._id);
      if (!leaderIds.length) {
        const existingLeaders = await User.find({
          companyId: company._id,
          role: "TEAM_LEADER",
          employeeNumber: { $regex: `^${company.companyCode}-AG` },
        }).select("_id");
        existingLeaders.forEach((u) => leaderIds.push(u._id));
      }
      for (let i = 0; i < staffDocs.length; i += 1) {
        if (staffDocs[i].role === "REPO_STAFF" && leaderIds.length) {
          staffDocs[i].teamLeaderId = leaderIds[i % leaderIds.length];
        }
      }
      if (staffDocs.length) await createInBatches(staffDocs, 10);
      created += leaderDocs.length + staffDocs.length;
    } catch (err) {
      errors.push(`${company.companyCode}: ${err.message}`);
    }

    if (c % 10 === 0) {
      console.log(`Progress: ${c}/${COMPANY_COUNT} companies processed (${created} created, ${skipped} skipped)`);
    }
  }

  const agents = await User.find({
    email: { $regex: "^agent\\.\\d{3}\\.\\d{3}@fastrecovery\\.test$" },
  })
    .select("email phone employeeNumber name role post isActive companyId")
    .populate("companyId", "companyCode companyName")
    .lean();

  const emails = agents.map((a) => a.email);
  const phones = agents.map((a) => a.phone);
  const codes = agents.map((a) => a.employeeNumber);
  const unique = (arr) => new Set(arr).size === arr.length && arr.every(Boolean);

  const perCompany = {};
  const missingCompany = [];
  const wrongCompany = [];
  for (const agent of agents) {
    const code = agent.companyId?.companyCode || "";
    perCompany[code] = (perCompany[code] || 0) + 1;
    if (!agent.companyId) missingCompany.push(agent.email);
    const expectedPrefix = code ? `${code}-AG` : "";
    if (code && agent.employeeNumber && !String(agent.employeeNumber).startsWith(expectedPrefix)) {
      wrongCompany.push(agent.employeeNumber);
    }
  }

  const companyCounts = companies.map((co) => perCompany[co.companyCode] || 0);
  const minAgents = Math.min(...companyCounts);
  const maxAgents = Math.max(...companyCounts);
  const notExpected = companies
    .filter((co) => (perCompany[co.companyCode] || 0) !== AGENTS_PER_COMPANY)
    .map((co) => `${co.companyCode}:${perCompany[co.companyCode] || 0}`);

  const sample = agents
    .filter((a) => a.companyId?.companyCode === "TESTC001")
    .sort((x, y) => String(x.employeeNumber).localeCompare(String(y.employeeNumber)));
  const samplePreview = [
    ...sample.slice(0, 3),
    ...sample.filter((a) => ["TESTC001-AG021", "TESTC001-AG100"].includes(a.employeeNumber)),
    ...sample.slice(-2),
  ].filter((row, idx, arr) => arr.findIndex((r) => r.employeeNumber === row.employeeNumber) === idx);

  console.log("\n=== 10,000 agents seed ===");
  console.log("Created this run:", created, "| skipped:", skipped);
  if (errors.length) console.log("Errors:", errors);

  console.log("\nVerification:");
  console.log("  Companies (TESTC001–TESTC100):", companies.length);
  console.log("  Total agents:", agents.length);
  console.log("  Unique agent codes:", unique(codes), `(${new Set(codes).size})`);
  console.log("  Unique emails:", unique(emails), `(${new Set(emails).size})`);
  console.log("  Unique mobiles:", unique(phones), `(${new Set(phones).size})`);
  console.log("  Missing company:", missingCompany.length);
  console.log("  Code/company mismatch:", wrongCompany.length);
  console.log("  Agents per company min/max:", minAgents, "/", maxAgents);
  console.log("  Companies not at 100 agents:", notExpected.length ? notExpected.join(", ") : "none");
  console.log("  Shared password:", PASSWORD);

  console.log("\nTESTC001 sample:");
  console.log("| Company Code | Company Name | Agent Code | Agent Name | Mobile | Email | Role | Status |");
  console.log("| ------------ | ------------ | ---------- | ---------- | ------ | ----- | ---- | ------ |");
  for (const a of samplePreview) {
    console.log(
      `| ${a.companyId.companyCode} | ${a.companyId.companyName} | ${a.employeeNumber} | ${a.name} | ${a.phone} | ${a.email} | ${a.post} (${a.role}) | ${a.isActive ? "ACTIVE" : "INACTIVE"} |`
    );
  }

  const ok =
    companies.length === COMPANY_COUNT &&
    agents.length === COMPANY_COUNT * AGENTS_PER_COMPANY &&
    unique(codes) &&
    unique(emails) &&
    unique(phones) &&
    missingCompany.length === 0 &&
    wrongCompany.length === 0 &&
    minAgents === AGENTS_PER_COMPANY &&
    maxAgents === AGENTS_PER_COMPANY &&
    !errors.length;

  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
