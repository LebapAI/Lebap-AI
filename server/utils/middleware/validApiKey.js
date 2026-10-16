const { ApiKey } = require("../../models/apiKeys");
const { SystemSettings } = require("../../models/systemSettings");
const { parseWorkspaceSlugs } = require("../apiKeyScopes");
const { apiKeyWorkspaceScope } = require("./apiKeyWorkspaceScope");
const { consumeApiKeyRateLimit } = require("../apiKeyRateLimiter");


async function validApiKey(request, response, next) {
  try {
    const multiUserMode = await SystemSettings.isMultiUserMode();
    response.locals.multiUserMode = multiUserMode;

    // Accept only an explicit Bearer token. Do not log or echo credentials.
    const authorization = request.header("Authorization");
    const parts =
      typeof authorization === "string" ? authorization.trim().split(/\s+/) : [];
    const scheme = parts[0];
    const bearerKey = parts.length === 2 && /^Bearer$/i.test(scheme)
      ? parts[1]
      : null;

    if (!bearerKey) {
      return response.status(403).json({
        error: "No valid api key found.",
      });
    }

    const apiKey = await ApiKey.getForAuthentication({ secret: bearerKey });
    if (!apiKey) {
      return response.status(403).json({
        error: "No valid api key found.",
      });
    }

    const now = Date.now();
    const expiryTime =
      apiKey.expiresAt === null || apiKey.expiresAt === undefined
        ? null
        : new Date(apiKey.expiresAt).getTime();
    const invalidExpiry =
      expiryTime !== null && !Number.isFinite(expiryTime);
    const expired = expiryTime !== null && expiryTime <= now;
    if (apiKey.revokedAt || invalidExpiry || expired) {
      return response.status(403).json({
        error: "No valid api key found.",
      });
    }

    // Keep only non-secret identity metadata for downstream authorization.
    // Never attach the bearer secret to request/response context.
    response.locals.apiKey = {
      id: apiKey.id,
      createdBy: apiKey.createdBy ?? null,
      name: apiKey.name ?? null,
      expiresAt: apiKey.expiresAt ?? null,
      revokedAt: apiKey.revokedAt ?? null,
      workspaceSlugs: parseWorkspaceSlugs(apiKey.workspaceSlugs),
    };

    // Last-use tracking is best-effort and never blocks authentication on telemetry failure.
    if (typeof ApiKey.markUsed === "function") await ApiKey.markUsed(apiKey.id);
    const continueAfterScope = async () => {
      let rateLimit;
      try {
        rateLimit = await consumeApiKeyRateLimit(Number(response.locals.apiKey.id));
      } catch (_error) {
        // Fail closed if the shared limiter cannot verify whether a key exceeded its limit.
        console.error("API key rate-limit check failed.");
        return response.status(503).json({ error: "API access temporarily unavailable." });
      }

      if (typeof response.setHeader === "function") {
        response.setHeader("X-RateLimit-Limit", String(rateLimit.limit));
        response.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
        response.setHeader("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetAt / 1000)));
      }

      if (!rateLimit.allowed) {
        if (typeof response.setHeader === "function") {
          response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
        }
        return response.status(429).json({
          error: "API rate limit exceeded.",
          limit: rateLimit.limit,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        });
      }

      return next();
    };

    return await apiKeyWorkspaceScope(request, response, continueAfterScope);
  } catch (_error) {
    // Fail closed if authentication infrastructure is unavailable.
    console.error("API key authentication failed due to an internal error.");
    return response.status(500).json({
      error: "Authentication service unavailable.",
    });
  }
}

module.exports = {
  validApiKey,
  parseWorkspaceSlugs,
};
