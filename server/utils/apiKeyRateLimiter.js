const prisma = require("../utils/prisma");

const WINDOW_MS = 60 * 1000;
const DEFAULT_REQUESTS_PER_MINUTE = 120;
let lastCleanupWindow = null;

function configuredRequestsPerMinute(value = process.env.API_KEY_RATE_LIMIT_PER_MINUTE) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_REQUESTS_PER_MINUTE;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) {
    throw new TypeError("API_KEY_RATE_LIMIT_PER_MINUTE must be an integer between 1 and 100000");
  }
  return parsed;
}

/**
 * Atomically consume one request from the API key's current UTC minute window.
 * The database counter is shared by all app instances; process memory is used
 * only to throttle best-effort cleanup, never to make allow/deny decisions.
 */
async function consumeApiKeyRateLimit(apiKeyId, now = Date.now(), limit = configuredRequestsPerMinute()) {
  if (!Number.isSafeInteger(apiKeyId) || apiKeyId <= 0) {
    throw new TypeError("apiKeyId must be a positive safe integer");
  }
  if (!Number.isFinite(now) || now < 0) {
    throw new TypeError("now must be a non-negative timestamp");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) {
    throw new TypeError("limit must be an integer between 1 and 100000");
  }

  const windowStart = Math.floor(now / WINDOW_MS);
  const counter = await prisma.api_key_rate_limit_windows.upsert({
    where: { apiKeyId_windowStart: { apiKeyId, windowStart } },
    create: { apiKeyId, windowStart, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
  });

  if (lastCleanupWindow !== windowStart) {
    lastCleanupWindow = windowStart;
    // Old windows do not affect the current decision. Cleanup is best-effort.
    prisma.api_key_rate_limit_windows
      .deleteMany({ where: { windowStart: { lt: windowStart - 10 } } })
      .catch(() => console.error("API key rate-limit cleanup failed."));
  }

  const resetAt = (windowStart + 1) * WINDOW_MS;
  const allowed = counter.requestCount <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - counter.requestCount),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

module.exports = {
  WINDOW_MS,
  DEFAULT_REQUESTS_PER_MINUTE,
  configuredRequestsPerMinute,
  consumeApiKeyRateLimit,
};
