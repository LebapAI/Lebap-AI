/**
 * Resolve a requested API-key workspace allowlist against the current workspace inventory.
 * Omitted scope retains compatibility with older clients by granting all current workspaces;
 * explicit scope is always validated and must contain at least one existing workspace.
 */
function resolveWorkspaceScope(requestedWorkspaceSlugs, availableWorkspaceSlugs = []) {
  const available = Array.isArray(availableWorkspaceSlugs)
    ? [...new Set(availableWorkspaceSlugs.filter((slug) => typeof slug === "string"))]
    : [];

  if (requestedWorkspaceSlugs === undefined) {
    return { workspaceSlugs: available, error: null };
  }

  if (
    !Array.isArray(requestedWorkspaceSlugs) ||
    requestedWorkspaceSlugs.length === 0 ||
    !requestedWorkspaceSlugs.every(
      (slug) => typeof slug === "string" && slug.trim().length > 0
    )
  ) {
    return {
      workspaceSlugs: null,
      error: "Choose at least one valid workspace for this API key.",
    };
  }

  const workspaceSlugs = [
    ...new Set(requestedWorkspaceSlugs.map((slug) => slug.trim())),
  ];
  const availableSet = new Set(available);
  if (workspaceSlugs.some((slug) => !availableSet.has(slug))) {
    return {
      workspaceSlugs: null,
      error: "One or more selected workspaces do not exist.",
    };
  }

  return { workspaceSlugs, error: null };
}

/**
 * Parse a persisted JSON workspace allowlist. Only SQL NULL/undefined means
 * legacy unrestricted access; malformed or empty values fail closed.
 */
function parseWorkspaceSlugs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((slug) => typeof slug === "string" && slug.trim().length > 0)
    ) {
      return [...new Set(parsed.map((slug) => slug.trim()))];
    }
  } catch (_error) {
    // Invalid persisted scope must fail closed.
  }
  return [];
}

/**
 * Legacy NULL scopes remain unrestricted during migration. Explicit allowlists
 * only authorize listed workspace slugs; malformed/empty lists authorize none.
 */
function isWorkspaceAllowed(workspaceSlugs, workspaceSlug) {
  return (
    workspaceSlugs === null ||
    workspaceSlugs === undefined ||
    (Array.isArray(workspaceSlugs) && workspaceSlugs.includes(workspaceSlug))
  );
}

module.exports = {
  resolveWorkspaceScope,
  parseWorkspaceSlugs,
  isWorkspaceAllowed,
};
