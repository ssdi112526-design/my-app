#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const API = "http://127.0.0.1:5001";

async function login(email) {
  const res = await fetch(`${API}/api/repo-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test@12345" }),
  });
  const json = await res.json();
  if (!json?.data?.token) throw new Error(`login ${res.status}`);
  return json.data.token;
}

async function search(token, params) {
  const qs = new URLSearchParams(params).toString();
  const started = Date.now();
  const res = await fetch(`${API}/api/repo-cases?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return { status: res.status, ms: Date.now() - started, json };
}

(async () => {
  const token = await login("repo.admin.01@fastrecovery.test");
  const tokenB = await login("repo.admin.02@fastrecovery.test");
  const page1 = await search(token, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 50 });
  const page2 = await search(token, { search: "E2E26", type: "vehicleNumber", page: 2, limit: 50 });
  const exact = await search(token, { search: "HR26AB1234", type: "vehicleNumber", page: 1, limit: 50 });
  const iso = await search(tokenB, { search: "E2E26", type: "vehicleNumber", page: 1, limit: 50 });
  const unauth = await fetch(`${API}/api/repo-cases?search=E2E26`);
  const badPresign = await fetch(`${API}/api/uploads/s3/presign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      bankName: "E2E Verify Bank",
      branchName: "E2E Delhi",
      fileName: "malware.exe",
    }),
  });
  const badPresignJson = await badPresign.json();
  const health = await fetch(`${API}/api/health`);

  console.log(
    JSON.stringify(
      {
        page1: {
          status: page1.status,
          items: (page1.json.items || []).length,
          limit: page1.json.limit,
          hasNext: page1.json.hasNext,
          hasPrevious: page1.json.hasPrevious,
          pagination: page1.json.pagination || null,
          ms: page1.ms,
        },
        page2: {
          status: page2.status,
          items: (page2.json.items || []).length,
          hasNext: page2.json.hasNext,
          hasPrevious: page2.json.hasPrevious,
          ms: page2.ms,
        },
        exact: { status: exact.status, total: exact.json.total, ms: exact.ms },
        companyB: { status: iso.status, total: iso.json.total },
        unauth: unauth.status,
        badPresign: { status: badPresign.status, message: badPresignJson.message || "" },
        health: health.status,
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
