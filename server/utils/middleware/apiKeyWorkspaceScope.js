const { filterWorkspacesByApiKeyScope, isWorkspaceAllowed } = require("../apiKeyScopes");

const SAFE_DOCUMENT_METADATA_PATHS = new Set([
  "/v1/document/accepted-file-types",
  "/v1/document/metadata-schema",
]);

function deny(response) {
  return response.status(403).json({
    error: "API key is not authorized for this workspace or operation.",
  });
}

/**
 * Enforce workspace allowlists on developer API routes. NULL scope remains
 * legacy-unrestricted for compatibility; explicit scopes fail closed.
 */
function apiKeyWorkspaceScope(request, response, next) {
  const scopes = response.locals?.apiKey?.workspaceSlugs;
  if (scopes === null || scopes === undefined) return next();
  if (!Array.isArray(scopes) || scopes.length === 0) return deny(response);

  const path = request.path;
  const method = String(request.method || "GET").toUpperCase();

  if (method === "GET" && path === "/v1/workspaces") {
    const originalJson = response.json.bind(response);
    response.json = (payload) => {
      if (payload && Array.isArray(payload.workspaces)) {
        return originalJson({
          ...payload,
          workspaces: filterWorkspacesByApiKeyScope(payload.workspaces, scopes),
        });
      }
      return originalJson(payload);
    };
    return next();
  }

  if (method === "POST" && path === "/v1/workspace/new") {
    return deny(response);
  }

  const slug =
    request.params?.slug ??
    request.params?.workspaceSlug ??
    request.body?.workspaceSlug;
  if (typeof slug === "string" && slug.length > 0) {
    return isWorkspaceAllowed(scopes, slug) ? next() : deny(response);
  }

  const addToWorkspaces = request.body?.addToWorkspaces;
  if (addToWorkspaces !== undefined && addToWorkspaces !== null && addToWorkspaces !== "") {
    const requested = Array.isArray(addToWorkspaces)
      ? addToWorkspaces
      : typeof addToWorkspaces === "string"
        ? addToWorkspaces.split(",").map((item) => item.trim()).filter(Boolean)
        : null;
    if (
      !requested ||
      requested.length === 0 ||
      requested.some((workspaceSlug) => !isWorkspaceAllowed(scopes, workspaceSlug))
    ) {
      return deny(response);
    }
    return next();
  }

  // These routes return static capability metadata and do not expose tenant data.
  if (method === "GET" && SAFE_DOCUMENT_METADATA_PATHS.has(path)) return next();

  // Scoped keys cannot perform workspace-less/global document operations.
  if (path.startsWith("/v1/document") || path.startsWith("/v1/documents")) {
    return deny(response);
  }

  return next();
}

module.exports = { apiKeyWorkspaceScope };
