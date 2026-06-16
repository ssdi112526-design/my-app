const Redis = require("ioredis");

let redisClient = null;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
}

/** Shared connection options for BullMQ (requires maxRetriesPerRequest: null). */
function getRedisConnectionOptions() {
  const url = getRedisUrl();
  if (!url) {
    throw new Error(
      "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_URL in backend/.env"
    );
  }

  return {
    url,
    maxRetriesPerRequest: null,
  };
}

function getRedisClient() {
  if (!isRedisConfigured()) return null;

  if (!redisClient) {
    redisClient = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return redisClient;
}

function createRedisSubscriber() {
  if (!isRedisConfigured()) return null;
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

module.exports = {
  isRedisConfigured,
  getRedisConnectionOptions,
  getRedisClient,
  createRedisSubscriber,
};
