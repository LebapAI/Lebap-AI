const crypto = require("crypto");
const prisma = require("../utils/prisma");

const ApiKey = {
  hashSecret: (secret) =>
    crypto.createHash("sha256").update(String(secret), "utf8").digest("hex"),
  tablename: "api_keys",
  writable: ["name"],

  makeSecret: () => {
    const uuidAPIKey = require("uuid-apikey");
    return uuidAPIKey.create().apiKey;
  },

  create: async function (createdByUserId = null, name = null, options = {}) {
    try {
      const normalizedName =
        typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
      const secret = this.makeSecret();
      const apiKey = await prisma.api_keys.create({
        data: {
          name: normalizedName,
          // Store only a one-way verifier for newly issued credentials.
          // The raw secret is returned once and is never persisted.
          secret: null,
          secretHash: this.hashSecret(secret),
          createdBy: createdByUserId,
          expiresAt: options.expiresAt || null,
        },
      });

      return { apiKey: { ...apiKey, secret }, error: null };
    } catch (error) {
      console.error("FAILED TO CREATE API KEY.", error.message);
      return { apiKey: null, error: error.message };
    }
  },

  // New keys are looked up by a one-way SHA-256 verifier. During migration,
  // retain exact-match lookup for legacy raw-secret records until they are rotated.
  // Authentication must distinguish an unknown key from a database failure.
  getForAuthentication: async function (clause = {}) {
    if (typeof clause.secret !== "string" || clause.secret.length === 0) {
      return prisma.api_keys.findFirst({ where: clause });
    }

    const suppliedSecret = clause.secret;
    return prisma.api_keys.findFirst({
      where: {
        OR: [
          { secretHash: this.hashSecret(suppliedSecret) },
          { secret: suppliedSecret },
        ],
      },
    });
  },

  get: async function (clause = {}) {
    try {
      const apiKey = await prisma.api_keys.findFirst({ where: clause });
      return apiKey;
    } catch (error) {
      console.error("FAILED TO GET API KEY.", error.message);
      return null;
    }
  },

  count: async function (clause = {}) {
    try {
      const count = await prisma.api_keys.count({ where: clause });
      return count;
    } catch (error) {
      console.error("FAILED TO COUNT API KEYS.", error.message);
      return 0;
    }
  },

  // Revoke without deleting the record so lifecycle and audit references remain available.
  revoke: async function (id) {
    try {
      const result = await prisma.api_keys.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date(), lastUpdatedAt: new Date() },
      });
      return result.count === 1;
    } catch (error) {
      console.error("FAILED TO REVOKE API KEY.", error.message);
      return false;
    }
  },

  // Kept for legacy internal callers; administrative revocation uses revoke().
  delete: async function (clause = {}) {
    try {
      await prisma.api_keys.deleteMany({ where: clause });
      return true;
    } catch (error) {
      console.error("FAILED TO DELETE API KEY.", error.message);
      return false;
    }
  },

  where: async function (clause = {}, limit) {
    try {
      const apiKeys = await prisma.api_keys.findMany({
        where: clause,
        take: limit,
      });
      return apiKeys;
    } catch (error) {
      console.error("FAILED TO GET API KEYS.", error.message);
      return [];
    }
  },

  whereWithUser: async function (clause = {}, limit) {
    try {
      const { User } = require("./user");
      const apiKeys = await this.where(clause, limit);

      for (const apiKey of apiKeys) {
        if (!apiKey.createdBy) continue;
        const user = await User.get({ id: apiKey.createdBy });
        if (!user) continue;

        apiKey.createdBy = {
          id: user.id,
          username: user.username,
          role: user.role,
        };
      }

      return apiKeys;
    } catch (error) {
      console.error("FAILED TO GET API KEYS WITH USER.", error.message);
      return [];
    }
  },
};

module.exports = { ApiKey };
