const { ApiKey } = require("../../../models/apiKeys");
const { EventLogs } = require("../../../models/eventLogs");
const { reqBody } = require("../../../utils/http");
const { validApiKey } = require("../../../utils/middleware/validApiKey");
const {
  apiKeyOwnerIsAdmin,
} = require("../../../utils/middleware/apiKeyOwnerIsAdmin");
const { Workspace } = require("../../../models/workspace");
const { parseWorkspaceSlugs } = require("../../../utils/apiKeyScopes");

function publicApiKey(apiKey) {
  const expiryTime =
    apiKey.expiresAt === null || apiKey.expiresAt === undefined
      ? null
      : new Date(apiKey.expiresAt).getTime();
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
    expiresAt: apiKey.expiresAt || null,
    revokedAt: apiKey.revokedAt || null,
    workspaceSlugs: parseWorkspaceSlugs(apiKey.workspaceSlugs),
    status: apiKey.revokedAt
      ? "revoked"
      : expiryTime !== null &&
          (!Number.isFinite(expiryTime) || expiryTime <= Date.now())
        ? "expired"
        : "active",
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

        let workspaceSlugs = null;
        if (
          !Array.isArray(body.workspaceSlugs) ||
          body.workspaceSlugs.length === 0 ||
          body.workspaceSlugs.length > 100 ||
          !body.workspaceSlugs.every(
            (slug) => typeof slug === "string" && /^[a-z0-9][a-z0-9_-]{0,99}$/.test(slug)
          )
        ) {
          return response.status(400).json({
            error: "workspaceSlugs is required and must be a non-empty array of valid workspace slugs (maximum 100).",
          });
        }
        workspaceSlugs = [...new Set(body.workspaceSlugs)];
        if (workspaceSlugs.length !== body.workspaceSlugs.length) {
          return response.status(400).json({
            error: "workspaceSlugs must not contain duplicates.",
          });
        }
        const existingWorkspaces = await Promise.all(
          workspaceSlugs.map((slug) => Workspace.get({ slug }))
        );
        if (existingWorkspaces.some((workspace) => !workspace)) {
          return response.status(400).json({
            error: "Every workspaceSlugs entry must reference an existing workspace.",
          });
        }

        let expiresAt = null;
        if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
          if (typeof body.expiresAt !== "string") {
            return response.status(400).json({
              error: "expiresAt must be an ISO-8601 date string.",
            });
          }
          const isoDate =
            /^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt) ||
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.expiresAt);
          const parsedExpiry = new Date(body.expiresAt);
          if (
            !isoDate ||
            Number.isNaN(parsedExpiry.getTime()) ||
            parsedExpiry.getTime() <= Date.now()
          ) {
            return response.status(400).json({
              error: "expiresAt must be a valid future date.",
            });
          }
          expiresAt = parsedExpiry;
        }

        const { apiKey } = await ApiKey.create(ownerId, name, {
          expiresAt,
          workspaceSlugs,
        });
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
          workspaceSlugs,
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

        const revoked = await ApiKey.revoke(id);
        if (!revoked) {
          return response.status(409).json({
            error: "API key is already revoked or could not be revoked.",
          });
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
