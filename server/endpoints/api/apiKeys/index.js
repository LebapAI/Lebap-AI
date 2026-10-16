const { ApiKey } = require("../../../models/apiKeys");
const { EventLogs } = require("../../../models/eventLogs");
const { reqBody } = require("../../../utils/http");
const { validApiKey } = require("../../../utils/middleware/validApiKey");
const {
  apiKeyOwnerIsAdmin,
} = require("../../../utils/middleware/apiKeyOwnerIsAdmin");

function publicApiKey(apiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name || null,
    createdBy:
      apiKey.createdBy && typeof apiKey.createdBy === "object"
        ? {
            id: apiKey.createdBy.id,
            username: apiKey.createdBy.username,
            role: apiKey.createdBy.role,
          }
        : apiKey.createdBy || null,
    createdAt: apiKey.createdAt || null,
    lastUpdatedAt: apiKey.lastUpdatedAt || null,
  };
}

async function recordAudit(event, metadata) {
  try {
    await EventLogs.logEvent(event, metadata);
  } catch (_error) {
    // Credential operations must not become ambiguous if audit storage is down.
    console.error("API key audit event could not be recorded.");
  }
}

function apiKeyManagementEndpoints(app) {
  if (!app) return;

  // Secrets are intentionally excluded from list responses. A newly created
  // secret is returned only in the creation response.
  app.get(
    "/v1/admin/api-keys",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (_request, response) => {
      try {
        const keys = await ApiKey.whereWithUser({}, 500);
        return response.status(200).json({ apiKeys: keys.map(publicApiKey) });
      } catch (_error) {
        console.error("API key listing failed.");
        return response.status(500).json({ error: "API key service unavailable." });
      }
    }
  );

  app.post(
    "/v1/admin/api-keys",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (request, response) => {
      try {
        const body = reqBody(request) || {};
        const name =
          typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 100) {
          return response.status(400).json({
            error: "A key name between 1 and 100 characters is required.",
          });
        }

        const ownerId = Number(response.locals?.apiKey?.createdBy);
        if (!Number.isInteger(ownerId) || ownerId <= 0) {
          return response.status(403).json({
            error: "Administrator-owned API key required.",
          });
        }

        const { apiKey } = await ApiKey.create(ownerId, name);
        if (!apiKey) {
          console.error("API key creation failed.");
          return response.status(500).json({
            error: "API key could not be created.",
          });
        }

        await recordAudit("api_key_created", {
          apiKeyId: apiKey.id,
          name: apiKey.name,
          createdBy: ownerId,
        });

        // This is the only response that includes the raw credential.
        return response.status(201).json({
          apiKey: {
            ...publicApiKey(apiKey),
            secret: apiKey.secret,
          },
          warning: "Copy this secret now. It will not be shown again.",
          error: null,
        });
      } catch (_error) {
        console.error("API key creation endpoint failed.");
        return response.status(500).json({ error: "API key service unavailable." });
      }
    }
  );

  app.delete(
    "/v1/admin/api-keys/:id",
    [validApiKey, apiKeyOwnerIsAdmin],
    async (request, response) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
          return response.status(400).json({ error: "Invalid API key id." });
        }

        const currentKeyId = Number(response.locals?.apiKey?.id);
        if (id === currentKeyId) {
          return response.status(409).json({
            error: "The API key used for this request cannot revoke itself.",
          });
        }

        const existing = await ApiKey.get({ id });
        if (!existing) {
          return response.status(404).json({ error: "API key not found." });
        }

        const deleted = await ApiKey.delete({ id });
        if (!deleted) {
          return response.status(500).json({ error: "API key could not be revoked." });
        }

        await recordAudit("api_key_revoked", {
          apiKeyId: id,
          createdBy: existing.createdBy || null,
        });
        return response.status(200).json({ success: true, revokedId: id });
      } catch (_error) {
        console.error("API key revocation endpoint failed.");
        return response.status(500).json({ error: "API key service unavailable." });
      }
    }
  );
}

module.exports = { apiKeyManagementEndpoints, publicApiKey };
