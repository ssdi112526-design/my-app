const Redis = require("ioredis");

let redisClient = null;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
}

function isUploadQueueEnabled() {
  return (
    isRedisConfigured() &&
    (process.env.UPLOAD_USE_QUEUE === "true" || process.env.UPLOAD_USE_QUEUE === "1")
  );
}

/**
 * Shared connection options for BullMQ and ioredis.
 * Preserves rediss:// TLS and URL user/password (Upstash / Redis Cloud).
 */
function getRedisConnectionOptions() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error(
      "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_URL in backend/.env"
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_err) {
    throw new Error("REDIS_URL is invalid. Use redis:// or rediss://host:port");
  }

  const isTls = parsed.protocol === "rediss:";
  const opts = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (parsed.username) {
    opts.username = decodeURIComponent(parsed.username);
  }
  if (parsed.password) {
    opts.password = decodeURIComponent(parsed.password);
  }
  if (isTls) {
    opts.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
    };
  }

  return opts;
}

function getRedisClient() {
  if (!isRedisConfigured()) return null;

  if (!redisClient) {
    redisClient = new Redis(getRedisConnectionOptions());
    redisClient.on("error", (err) => {
      console.error("Redis client error:", err.message);
    });
  }

  return redisClient;
}

function createRedisSubscriber() {
  if (!isRedisConfigured()) return null;
  const subscriber = new Redis(getRedisConnectionOptions());
  subscriber.on("error", (err) => {
    console.error("Redis subscriber error:", err.message);
  });
  return subscriber;
}

async function closeRedisClients() {
  const pending = [];
  if (redisClient) {
    pending.push(redisClient.quit().catch(() => redisClient.disconnect()));
    redisClient = null;
  }
  await Promise.all(pending);
}

function redisHostLabel() {
  try {
    const opts = getRedisConnectionOptions();
    return `${opts.tls ? "rediss" : "redis"}://${opts.host}:${opts.port}`;
  } catch (_err) {
    return "unconfigured";
  }
}

module.exports = {
  isRedisConfigured,
  isUploadQueueEnabled,
  getRedisConnectionOptions,
  getRedisClient,
  createRedisSubscriber,
  closeRedisClients,
  redisHostLabel,
};
