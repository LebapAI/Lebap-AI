const { ApiKey } = require("../../models/apiKeys");
const { SystemSettings } = require("../../models/systemSettings");

function parseWorkspaceSlugs(value) {
  // Only SQL NULL/undefined denotes a legacy, unrestricted key. An empty
  // string is malformed persisted scope and must not silently grant access.
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((slug) => typeof slug === "string" && slug.trim().length > 0)
    ) return [...new Set(parsed.map((slug) => slug.trim()))];
  } catch (_error) {
    // Invalid stored scope must fail closed.
  }
  return [];
}

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
    const expired =
      apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= now;
    if (apiKey.revokedAt || expired) {
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

    return next();
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
