const {
  apiKeyWorkspaceScope,
  requestedWorkspaceSlugs,
} = require("./apiKeyWorkspaceScope");

function setup(scopes, request = {}) {
  const response = {
    locals: { apiKey: { workspaceSlugs: scopes } },
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (body) {
      this.body = body;
      return this;
    }),
  };
  const next = jest.fn();
  const normalizedRequest = {
    path: "/v1/workspace/example",
    method: "GET",
    params: {},
    query: {},
    body: {},
    ...request,
  };
  return { response, next, request: normalizedRequest };
}

describe("API key workspace scope middleware", () => {
  test("rejects a workspace selected through query string when it is outside the allowlist", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path: "/v1/workspace",
      query: { workspaceSlug: "private-workspace" },
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("does not let an allowed path selector hide a denied query selector", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      params: { slug: "allowed-workspace" },
      query: { workspace_slug: "private-workspace" },
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("allows a workspace selected through query string when it is in the allowlist", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path: "/v1/workspace",
      query: { workspaceSlug: "allowed-workspace" },
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("fails closed for explicit empty scopes on workspace-less document operations", () => {
    const { response, next, request } = setup([], {
      path: "/v1/document/upload",
      method: "POST",
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("preserves legacy NULL-scope compatibility", () => {
    const { response, next, request } = setup(null, {
      path: "/v1/document/upload",
      method: "POST",
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("filters workspace listings to the allowlist", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path: "/v1/workspaces",
      method: "GET",
    });
    apiKeyWorkspaceScope(request, response, next);
    response.json({
      workspaces: [
        { slug: "allowed-workspace" },
        { slug: "private-workspace" },
      ],
    });

    expect(response.body.workspaces).toEqual([{ slug: "allowed-workspace" }]);
  });

  test.each([
    ["document inventory", "/v1/documents"],
    ["document metadata by name", "/v1/document/private-document.txt"],
    ["document folder inventory", "/v1/documents/folder/private-folder"],
  ])("denies scoped keys from workspace-less %s routes", (_label, path) => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path,
      method: "GET",
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    "/v1/document/accepted-file-types",
    "/v1/document/metadata-schema",
  ])("allows non-sensitive document capability metadata at %s", (path) => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path,
      method: "GET",
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("allows addToWorkspaces only when every target workspace is in scope", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path: "/v1/document/upload-link",
      method: "POST",
      body: { addToWorkspaces: "allowed-workspace" },
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("rejects addToWorkspaces when any target workspace is outside scope", () => {
    const { response, next, request } = setup(["allowed-workspace"], {
      path: "/v1/document/upload-link",
      method: "POST",
      body: { addToWorkspaces: "allowed-workspace,private-workspace" },
    });

    apiKeyWorkspaceScope(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("collects all supported workspace selector locations", () => {
    expect(
      requestedWorkspaceSlugs({
        params: { slug: " path " },
        body: { workspaceSlug: "body" },
        query: { workspaceSlug: "query", workspace_slug: "legacy-query" },
      })
    ).toEqual(["path", "body", "query", "legacy-query"]);
  });
});
