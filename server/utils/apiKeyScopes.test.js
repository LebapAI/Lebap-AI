const { resolveWorkspaceScope, parseWorkspaceSlugs, isWorkspaceAllowed, filterWorkspacesByApiKeyScope } = require("./apiKeyScopes");

describe("resolveWorkspaceScope", () => {
  const available = ["research", "support", "billing"];

  test("defaults omitted scope to all existing workspaces for compatibility", () => {
    expect(resolveWorkspaceScope(undefined, available)).toEqual({
      workspaceSlugs: available,
      error: null,
    });
  });

  test("accepts explicit valid scopes and removes duplicates", () => {
    expect(resolveWorkspaceScope([" support ", "research", "support"], available)).toEqual({
      workspaceSlugs: ["support", "research"],
      error: null,
    });
  });

  test.each([null, "research", [], [""], ["   "], ["research", 7]])(
    "rejects malformed or empty explicit scopes: %p",
    (requested) => {
      const result = resolveWorkspaceScope(requested, available);
      expect(result.workspaceSlugs).toBeNull();
      expect(result.error).toMatch(/Choose at least one valid workspace/);
    }
  );

  test("rejects unknown workspace slugs", () => {
    expect(resolveWorkspaceScope(["research", "unknown"], available)).toEqual({
      workspaceSlugs: null,
      error: "One or more selected workspaces do not exist.",
    });
  });

  test("deduplicates the workspace inventory before returning the compatibility scope", () => {
    expect(resolveWorkspaceScope(undefined, ["research", "research", "support"])).toEqual({
      workspaceSlugs: ["research", "support"],
      error: null,
    });
  });
});

describe("parseWorkspaceSlugs", () => {
  test("treats only null and undefined as legacy unrestricted scope", () => {
    expect(parseWorkspaceSlugs(null)).toBeNull();
    expect(parseWorkspaceSlugs(undefined)).toBeNull();
  });

  test.each(["", "not-json", "{}", "[]", "[\"\"]", "[\"support\", 3]"])(
    "fails closed for malformed persisted scopes: %p",
    (value) => {
      expect(parseWorkspaceSlugs(value)).toEqual([]);
    }
  );

  test("parses, trims, and deduplicates a valid persisted scope", () => {
    expect(parseWorkspaceSlugs('[\"support\", \" research \", \"support\"]')).toEqual([
      "support",
      "research",
    ]);
  });
});

describe("isWorkspaceAllowed", () => {
  test("allows legacy unrestricted scope only when scope is absent", () => {
    expect(isWorkspaceAllowed(null, "support")).toBe(true);
    expect(isWorkspaceAllowed(undefined, "support")).toBe(true);
  });

  test("allows only an explicitly listed workspace", () => {
    expect(isWorkspaceAllowed(["support"], "support")).toBe(true);
    expect(isWorkspaceAllowed(["support"], "billing")).toBe(false);
    expect(isWorkspaceAllowed([], "support")).toBe(false);
  });

  test("fails closed for invalid non-array scopes", () => {
    expect(isWorkspaceAllowed("support", "support")).toBe(false);
  });
});


describe("filterWorkspacesByApiKeyScope", () => {
  const workspaces = [
    { slug: "research", name: "Research" },
    { slug: "billing", name: "Billing" },
    { slug: "support", name: "Support" },
  ];

  test("returns only explicitly allowed workspace records", () => {
    expect(filterWorkspacesByApiKeyScope(workspaces, ["support", "research"])).toEqual([
      workspaces[0],
      workspaces[2],
    ]);
  });

  test("keeps legacy unrestricted keys backward-compatible", () => {
    expect(filterWorkspacesByApiKeyScope(workspaces, null)).toEqual(workspaces);
  });

  test("fails closed for empty or malformed scopes", () => {
    expect(filterWorkspacesByApiKeyScope(workspaces, [])).toEqual([]);
    expect(filterWorkspacesByApiKeyScope(workspaces, "support")).toEqual([]);
    expect(filterWorkspacesByApiKeyScope(null, ["support"])).toEqual([]);
  });
});
