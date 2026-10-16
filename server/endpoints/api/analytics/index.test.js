jest.mock("../../../utils/prisma", () => ({
  api_usage_events: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  users: { count: jest.fn() },
  workspaces: { count: jest.fn() },
  api_keys: { count: jest.fn() },
}));
jest.mock("../../../utils/middleware/validApiKey", () => ({
  validApiKey: jest.fn(),
}));
jest.mock("../../../utils/middleware/apiKeyOwnerIsAdmin", () => ({
  apiKeyOwnerIsAdmin: jest.fn(),
}));

const prisma = require("../../../utils/prisma");
const { validApiKey } = require("../../../utils/middleware/validApiKey");
const { apiKeyOwnerIsAdmin } = require("../../../utils/middleware/apiKeyOwnerIsAdmin");
const { businessAnalyticsEndpoints } = require("./index");

function setup() {
  const routes = new Map();
  const app = {
    get: jest.fn((path, middleware, handler) => routes.set(path, { middleware, handler })),
  };
  businessAnalyticsEndpoints(app);
  const response = {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
  return { route: routes.get("/v1/admin/business-analytics"), response };
}

function mockSuccessfulQueries() {
  prisma.api_usage_events.aggregate
    .mockResolvedValueOnce({
      _count: { _all: 5 },
      _sum: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      _avg: { latencyMs: 125.4 },
    })
    .mockResolvedValueOnce({
      _count: { _all: 2 },
      _sum: { estimatedCostUsd: 0.12 },
    });
  prisma.api_usage_events.groupBy
    .mockResolvedValueOnce([
      { status: "completed", _count: { _all: 4 } },
      { status: "failed", _count: { _all: 1 } },
    ])
    .mockResolvedValueOnce([
      { model: "model-a", _count: { _all: 5 }, _sum: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
    ])
    .mockResolvedValueOnce([
      { provider: "provider-a", _count: { _all: 5 } },
    ]);
  prisma.users.count.mockResolvedValueOnce(7).mockResolvedValueOnce(6);
  prisma.workspaces.count.mockResolvedValueOnce(3);
  prisma.api_keys.count.mockResolvedValueOnce(4);
}

describe("business analytics endpoint", () => {
  beforeEach(() => jest.clearAllMocks());

  test("is protected by API-key authentication and administrator authorization", () => {
    const { route } = setup();
    expect(route.middleware).toEqual([validApiKey, apiKeyOwnerIsAdmin]);
  });

  test("rejects invalid date ranges before querying the database", async () => {
    const { route, response } = setup();
    await route.handler({ query: { from: "invalid-date", to: "2026-10-16T00:00:00.000Z" } }, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(prisma.api_usage_events.aggregate).not.toHaveBeenCalled();
  });

  test("rejects ranges longer than one year", async () => {
    const { route, response } = setup();
    await route.handler({ query: { from: "2024-01-01T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" } }, response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  test("returns aggregate operational metrics and clearly marks missing revenue", async () => {
    mockSuccessfulQueries();
    const { route, response } = setup();
    await route.handler({ query: {} }, response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body.activity).toMatchObject({
      requests: 5,
      completed: 4,
      failed: 1,
      successRate: 80,
      averageLatencyMs: 125,
    });
    expect(response.body.tokens).toEqual({ input: 10, output: 20, total: 30 });
    expect(response.body.estimatedCosts).toMatchObject({
      total: 0.12,
      eventsWithKnownCost: 2,
      coveragePercent: 40,
    });
    expect(response.body.financials).toMatchObject({ revenue: null, profit: null });
    expect(response.body.platform).toEqual({
      totalUsers: 7,
      activeUsers: 6,
      totalWorkspaces: 3,
      totalApiKeys: 4,
    });
  });

  test("fails safely when the ledger schema/client is unavailable", async () => {
    prisma.api_usage_events.aggregate.mockRejectedValueOnce(new Error("schema unavailable"));
    const { route, response } = setup();
    await route.handler({ query: {} }, response);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.body.error).toMatch(/migration may not be applied/i);
  });
});
