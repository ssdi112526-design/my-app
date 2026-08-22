/**
 * Per-process fixed-window limiter. Safe for a single API instance.
 * Disable with RATE_LIMIT_ENABLED=false. Does not apply to Socket.IO.
 */

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isRateLimitEnabled() {
  return process.env.RATE_LIMIT_ENABLED !== "false";
}

function clientKey(req) {
  const user = req.user && (req.user.userId || req.user._id);
  if (user) return `u:${user}`;
  return `ip:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
}

function createRateLimiter({ windowMs, max, name }) {
  const hits = new Map();

  const janitor = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 15000));
  if (typeof janitor.unref === "function") janitor.unref();

  return function rateLimitMiddleware(req, res, next) {
    if (!isRateLimitEnabled()) return next();

    const maxHits = envInt(
      name === "search"
        ? "SEARCH_RATE_LIMIT"
        : name === "upload"
          ? "UPLOAD_RATE_LIMIT"
          : name === "auth"
            ? "AUTH_RATE_LIMIT"
            : "API_RATE_LIMIT",
      max
    );

    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader("X-RateLimit-Limit", String(maxHits));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxHits - entry.count)));

    if (entry.count > maxHits) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Try again shortly.",
      });
    }
    return next();
  };
}

const authRateLimit = createRateLimiter({
  name: "auth",
  windowMs: envInt("AUTH_RATE_WINDOW_MS", 15 * 60 * 1000),
  max: envInt("AUTH_RATE_LIMIT", 30),
});

const searchRateLimit = createRateLimiter({
  name: "search",
  windowMs: envInt("SEARCH_RATE_WINDOW_MS", 60 * 1000),
  max: envInt("SEARCH_RATE_LIMIT", 120),
});

const uploadRateLimit = createRateLimiter({
  name: "upload",
  windowMs: envInt("UPLOAD_RATE_WINDOW_MS", 15 * 60 * 1000),
  max: envInt("UPLOAD_RATE_LIMIT", 40),
});

const apiRateLimit = createRateLimiter({
  name: "api",
  windowMs: envInt("API_RATE_WINDOW_MS", 60 * 1000),
  max: envInt("API_RATE_LIMIT", 300),
});

module.exports = {
  authRateLimit,
  searchRateLimit,
  uploadRateLimit,
  apiRateLimit,
};
