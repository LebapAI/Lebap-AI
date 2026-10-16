const { resolveWorkspaceScope } = require("./apiKeyScopes");

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
