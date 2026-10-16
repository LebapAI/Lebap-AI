const { User } = require("../../models/user");

/**
 * Require an API key owned by an active administrator for privileged API routes.
 * Must run after validApiKey, which places non-secret key metadata in response.locals.
 * Legacy keys without an owner fail closed; create a new key while signed in as an admin.
 */
async function apiKeyOwnerIsAdmin(_request, response, next) {
  try {
    const ownerId = response.locals?.apiKey?.createdBy;
    if (!Number.isInteger(Number(ownerId)) || Number(ownerId) <= 0) {
      return response.status(403).json({
        error: "Administrator-owned API key required.",
      });
    }

    const owner = await User.getForAuthorization({ id: Number(ownerId) });
    if (!owner || owner.role !== "admin" || Boolean(owner.suspended)) {
      return response.status(403).json({
        error: "Administrator privileges required.",
      });
    }

    return next();
  } catch (_error) {
    console.error("API key administrator authorization failed.");
    return response.status(500).json({
      error: "Authorization service unavailable.",
    });
  }
}

module.exports = { apiKeyOwnerIsAdmin };
