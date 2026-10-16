const { ApiKey } = require("../../../models/apiKeys");
const { EventLogs } = require("../../../models/eventLogs");
const { reqBody } = require("../../../utils/http");
const {
  apiKeyManagementEndpoints,
  publicApiKey,
} = require("./index");

jest.mock("../../../models/apiKeys", () => ({
  ApiKey: {
    whereWithUser: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../../models/eventLogs", () => ({
  EventLogs: { logEvent: jest.fn() },
}));

jest.mock("../../../utils/http", () => ({
  reqBody: jest.fn(),
}));

jest.mock("../../../utils/middleware/validApiKey", () => ({
  validApiKey: jest.fn(),
}));

jest.mock("../../../utils/middleware/apiKeyOwnerIsAdmin", () => ({
  apiKeyOwnerIsAdmin: jest.fn(),
}));

function setup() {
  const routes = {};
  const app = {
    get: jest.fn((path, middleware, handler) => {
      routes[`GET ${path}`] = { middleware, handler };
    }),
    post: jest.fn((path, middleware, handler) => {
      routes[`POST ${path}`] = { middleware, handler };
    }),
    delete: jest.fn((path, middleware, handler) => {
      routes[`DELETE ${path}`] = { middleware, handler };
    }),
  };
  apiKeyManagementEndpoints(app);
  return routes;
}

function makeResponse(locals = {}) {
  const response = {
    locals,
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  return response;
}

describe("API key management endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test("publicApiKey never exposes the stored secret", () => {
    expect(
      publicApiKey({
        id: 5,
        name: "automation",
        secret: "never-return-this",
        createdBy: { id: 7, username: "admin", role: "admin" },
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    ).toEqual({
      id: 5,
      name: "automation",
      createdBy: { id: 7, username: "admin", role: "admin" },
      createdAt: "2026-01-01T00:00:00.000Z",
      lastUpdatedAt: null,
    });
  });

  test("registers every route behind API key and administrator guards", () => {
    const routes = setup();
    for (const key of [
      "GET /v1/admin/api-keys",
      "POST /v1/admin/api-keys",
      "DELETE /v1/admin/api-keys/:id",
    ]) {
      expect(routes[key].middleware).toHaveLength(2);
      expect(routes[key].middleware[0]).toBe(require("../../../utils/middleware/validApiKey").validApiKey);
      expect(routes[key].middleware[1]).toBe(require("../../../utils/middleware/apiKeyOwnerIsAdmin").apiKeyOwnerIsAdmin);
    }
  });

  test("lists keys without exposing secrets", async () => {
    const routes = setup();
    ApiKey.whereWithUser.mockResolvedValue([
      { id: 1, name: "job", secret: "secret-value", createdBy: 7 },
    ]);
    const response = makeResponse();
    await routes["GET /v1/admin/api-keys"].handler({}, response);
    expect(response.statusCode).toBe(200);
    expect(response.payload.apiKeys[0]).toEqual({
      id: 1,
      name: "job",
      createdBy: 7,
      createdAt: null,
      lastUpdatedAt: null,
    });
    expect(JSON.stringify(response.payload)).not.toContain("secret-value");
  });

  test("rejects an invalid name before creating a key", async () => {
    const routes = setup();
    reqBody.mockReturnValue({ name: "   " });
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["POST /v1/admin/api-keys"].handler({}, response);
    expect(response.statusCode).toBe(400);
    expect(ApiKey.create).not.toHaveBeenCalled();
  });

  test("creates a key for the authenticated administrator and returns its secret once", async () => {
    const routes = setup();
    reqBody.mockReturnValue({ name: "  nightly automation  " });
    ApiKey.create.mockResolvedValue({
      apiKey: {
        id: 11,
        name: "nightly automation",
        secret: "new-secret",
        createdBy: 7,
      },
      error: null,
    });
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["POST /v1/admin/api-keys"].handler({}, response);
    expect(ApiKey.create).toHaveBeenCalledWith(7, "nightly automation");
    expect(response.statusCode).toBe(201);
    expect(response.payload.apiKey.secret).toBe("new-secret");
    expect(response.payload.warning).toMatch(/not be shown again/i);
  });

  test("does not allow the current key to revoke itself", async () => {
    const routes = setup();
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["DELETE /v1/admin/api-keys/:id"].handler(
      { params: { id: "10" } },
      response
    );
    expect(response.statusCode).toBe(409);
    expect(ApiKey.delete).not.toHaveBeenCalled();
  });

  test("revokes an existing different key and records an audit event", async () => {
    const routes = setup();
    ApiKey.get.mockResolvedValue({ id: 12, createdBy: 8 });
    ApiKey.delete.mockResolvedValue(true);
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["DELETE /v1/admin/api-keys/:id"].handler(
      { params: { id: "12" } },
      response
    );
    expect(ApiKey.delete).toHaveBeenCalledWith({ id: 12 });
    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({ success: true, revokedId: 12 });
    expect(EventLogs.logEvent).toHaveBeenCalledWith("api_key_revoked", {
      apiKeyId: 12,
      createdBy: 8,
    });
  });

  test("returns the created secret even when audit storage is unavailable", async () => {
    const routes = setup();
    reqBody.mockReturnValue({ name: "service integration" });
    ApiKey.create.mockResolvedValue({
      apiKey: { id: 15, name: "service integration", secret: "one-time-secret", createdBy: 7 },
      error: null,
    });
    EventLogs.logEvent.mockRejectedValue(new Error("audit database unavailable"));
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["POST /v1/admin/api-keys"].handler({}, response);
    expect(response.statusCode).toBe(201);
    expect(response.payload.apiKey.secret).toBe("one-time-secret");
    expect(console.error).toHaveBeenCalledWith("API key audit event could not be recorded.");
  });

  test("rejects malformed IDs and does not query or delete a key", async () => {
    const routes = setup();
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["DELETE /v1/admin/api-keys/:id"].handler(
      { params: { id: "NaN" } },
      response
    );
    expect(response.statusCode).toBe(400);
    expect(ApiKey.get).not.toHaveBeenCalled();
    expect(ApiKey.delete).not.toHaveBeenCalled();
  });

  test("returns not found when a revocation target does not exist", async () => {
    const routes = setup();
    ApiKey.get.mockResolvedValue(null);
    const response = makeResponse({ apiKey: { id: 10, createdBy: 7 } });
    await routes["DELETE /v1/admin/api-keys/:id"].handler(
      { params: { id: "99" } },
      response
    );
    expect(response.statusCode).toBe(404);
    expect(ApiKey.delete).not.toHaveBeenCalled();
  });

});