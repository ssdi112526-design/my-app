const { Pool } = require("pg");

let pool = null;
let connectionString = "";

function sslFor(url) {
  if (!url) return false;
  const local =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("@postgres:") ||
    url.includes("@postgresql:");
  if (local && !url.includes("render.com") && !url.includes("ssl=true")) {
    return false;
  }
  return { rejectUnauthorized: false };
}

function initPool(url) {
  if (!url) {
    throw new Error("DATABASE_URL missing in .env");
  }
  if (pool && connectionString === url) return pool;

  if (pool) {
    pool.end().catch(() => {});
  }

  connectionString = url;
  pool = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: Number(process.env.PG_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15000),
  });

  pool.on("error", (err) => {
    console.error("PostgreSQL pool error:", err.message);
  });

  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error("PostgreSQL pool not initialized. Call connectDB first.");
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    connectionString = "";
  }
}

module.exports = {
  initPool,
  getPool,
  query,
  closePool,
};
