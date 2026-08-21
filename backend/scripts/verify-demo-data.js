#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const mongoose = require("../src/db/mongoose");
const User = require("../src/modules/users/user.model");
const Company = require("../src/modules/companies/company.model");
const Bank = require("../src/modules/bank/bank.model");
const RepoCase = require("../src/modules/repoCases/repoCase.model");

const API = process.env.VERIFY_API_URL || "http://localhost:5001/api";
const PASSWORD = "Test@12345";

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function summarize(label, result) {
  const data = result.json?.data;
  const items = result.json?.items;
  const total =
    result.json?.total ??
    data?.total ??
    (Array.isArray(data?.items) ? data.items.length : null) ??
    (Array.isArray(data?.companies) ? data.companies.length : null) ??
    (Array.isArray(data?.records) ? data.records.length : null) ??
    (Array.isArray(data?.users) ? data.users.length : null) ??
    (Array.isArray(data?.banks) ? data.banks.length : null) ??
    (Array.isArray(items) ? items.length : null) ??
    (Array.isArray(data) ? data.length : null);
  const ok = result.status < 400 && result.json?.success !== false;
  console.log(
    `  ${ok ? "OK" : "FAIL"} ${label}  HTTP ${result.status}` +
      (total != null ? `  count=${total}` : "") +
      (result.json?.message ? `  ${result.json.message}` : "")
  );
  return ok;
}

async function main() {
  await connectDB(process.env.DATABASE_URL);

  const companies = await Company.find({ companyCode: { $regex: "^TESTC" } }).lean();
  const banks = await Bank.find({ bankCode: { $regex: "^TESTB" } }).lean();
  const cases = await RepoCase.find({ caseCode: { $regex: "^TEST-CASE-" } }).lean();
  const demoUsers = await User.find({ email: { $regex: "@fastrecovery\\.test$" } }).lean();

  const companyIds = new Set(companies.map((c) => String(c._id)));
  const bankIds = new Set(banks.map((b) => String(b._id)));
  const orphans = {
    usersMissingCompany: demoUsers.filter(
      (u) =>
        ["REPO_ADMIN", "TEAM_LEADER", "HEAD_OFFICE_STAFF", "OFFICE_STAFF", "REPO_STAFF", "REPO_VIEWER"].includes(
          u.role
        ) && !companyIds.has(String(u.companyId))
    ).length,
    usersMissingBank: demoUsers.filter(
      (u) => ["BANK_ADMIN", "BANK_PERSON"].includes(u.role) && !bankIds.has(String(u.bankId))
    ).length,
    casesMissingCompany: cases.filter((c) => !companyIds.has(String(c.companyId))).length,
    companiesMissingAdmin: companies.filter((c) => !c.repoAdminUserId).length,
    banksMissingAdmin: banks.filter((b) => !b.adminUserId).length,
    casesMissingAssignee: cases.filter((c) => !c.assignedToUserId).length,
  };

  console.log("Relationship check:", orphans);
  console.log("Demo companies:", companies.length, "banks:", banks.length, "cases:", cases.length, "users:", demoUsers.length);

  const logins = [
    ["/auth/ssdi-login", "ssdi.admin.01@fastrecovery.test", "SSDI"],
    ["/repo-admin/login", "repo.admin.01@fastrecovery.test", "REPO_ADMIN"],
    ["/auth/repo-agent-login", "field.agent.01@fastrecovery.test", "FIELD_AGENT"],
    ["/auth/repo-agent-login", "team.leader.01@fastrecovery.test", "TEAM_LEADER"],
    ["/auth/repo-agent-login", "head.office.01@fastrecovery.test", "HEAD_OFFICE"],
    ["/auth/repo-agent-login", "office.staff.01@fastrecovery.test", "OFFICE_STAFF"],
    ["/auth/repo-agent-login", "repo.viewer.01@fastrecovery.test", "REPO_VIEWER"],
    ["/bank/login", "bank.admin.01@fastrecovery.test", "BANK_ADMIN"],
    ["/bank/login", "bank.user.01@fastrecovery.test", "BANK_PERSON"],
  ];

  const tokens = {};
  console.log("\nLogin checks:");
  for (const [path, email, key] of logins) {
    const result = await post(path, { email, password: PASSWORD });
    const token = result.json?.data?.token;
    const ok = result.status === 200 && Boolean(token);
    tokens[key] = token;
    console.log(
      `  ${ok ? "OK" : "FAIL"} ${key}  ${email}  HTTP ${result.status}  ${result.json?.message || ""}`
    );
  }

  const ssdi = tokens.SSDI;
  const repo = tokens.REPO_ADMIN;
  const agent = tokens.FIELD_AGENT;
  const bank = tokens.BANK_ADMIN;

  console.log("\nList / detail API checks:");
  if (ssdi) {
    summarize("SSDI companies", await get("/companies?limit=50", ssdi));
    summarize("SSDI banks", await get("/bank/ssdi/list", ssdi));
    summarize("SSDI plans", await get("/plans", ssdi));
    const company = companies[0];
    if (company) {
      summarize("SSDI company detail", await get(`/companies/${company._id}`, ssdi));
      summarize("SSDI company users", await get(`/companies/${company._id}/users`, ssdi));
    }
  }
  if (repo) {
    summarize("Repo me", await get("/repo-admin/me", repo));
    summarize("Repo company", await get("/repo-admin/company", repo));
    summarize("Repo cases", await get("/repo-cases?limit=20", repo));
    summarize("Repo case search", await get("/repo-cases?search=TEST-CASE-01", repo));
    summarize("Repo users", await get("/repo-users", repo));
    summarize("Confirmations", await get("/confirmations", repo));
    summarize("Blacklist", await get("/blacklist", repo));
    summarize("Finances", await get("/finances", repo));
    summarize("Uploads", await get("/uploads", repo));
    const c0 = cases[0];
    if (c0) summarize("Repo case detail", await get(`/repo-cases/${c0._id}`, repo));
  }
  if (agent) {
    summarize("Agent cases", await get("/repo-cases?limit=20", agent));
    summarize("Agent vehicle search", await get("/repo-cases?type=vehicleNumber&search=DL01TE01", agent));
  }
  if (bank) {
    summarize("Bank records", await get("/bank/records", bank));
    summarize("Bank persons", await get("/bank/persons", bank));
    summarize("Bank uploads", await get("/bank/uploads", bank));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
