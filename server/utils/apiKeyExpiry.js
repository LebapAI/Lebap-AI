const ALLOWED_EXPIRY_DAYS = new Set([30, 90, 365]);

/**
 * Resolve the API-key lifetime requested by a client.
 * Omitted/null/"never" preserves compatibility for existing API clients.
 */
function resolveApiKeyExpiry(value) {
  if (value === undefined || value === null || value === "never") {
    return { expiresAt: null, error: null };
  }

  const days = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(days) || !ALLOWED_EXPIRY_DAYS.has(days)) {
    return {
      expiresAt: null,
      error: "expiresInDays must be 30, 90, 365, or null for no expiration.",
    };
  }

  return {
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    error: null,
  };
}

module.exports = { resolveApiKeyExpiry, ALLOWED_EXPIRY_DAYS };
