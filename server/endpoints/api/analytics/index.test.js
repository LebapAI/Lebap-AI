jest.mock("../../../utils/prisma", () => ({
  $queryRawUnsafe: jest.fn(),
  api_usage_events: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  users: { count: jest.fn() },
  workspaces: { count: jest.fn() },
  api_keys: { count: jest.fn() },
}));
const mockAdminOnlyMiddleware = jest.fn();
jest.mock("../../../utils/middleware/validatedRequest", () => ({
  validatedRequest: jest.fn(),
}));
jest.mock("../../../utils/middleware/multiUserProtected", () => ({
  flexUserRoleValid: jest.fn(() => mockAdminOnlyMiddleware),
  ROLES: { admin: "admin" },
}));

const prisma = require("../../../utils/prisma");
const { validatedRequest } = require("../../../utils/middleware/validatedRequest");
const { flexUserRoleValid } = require("../../../utils/middleware/multiUserProtected");
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
  return { route: routes.get("/admin/business-analytics"), response };
}

function mockSuccessfulQueries() {
  prisma.api_usage_events.aggregate
    .mockResolvedValueOnce({
      _count: { _all: 6 },
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
      { status: "started", _count: { _all: 1 } },
    ])
    .mockResolvedValueOnce([
      { model: "model-a", _count: { _all: 6 }, _sum: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
    ])
    .mockResolvedValueOnce([
      { provider: "provider-a", _count: { _all: 6 } },
    ]);
  prisma.$queryRawUnsafe.mockResolvedValueOnce([
    {
      date: "2026-10-15",
      requests: 5n,
      completed: 4n,
      failed: 1n,
      totalTokens: 30n,
      knownCostEvents: 2n,
      knownCostUsd: 0.12,
    },
  ]);
  prisma.users.count.mockResolvedValueOnce(7).mockResolvedValueOnce(6);
  prisma.workspaces.count.mockResolvedValueOnce(3);
  prisma.api_keys.count.mockResolvedValueOnce(4);
}

describe("business analytics endpoint", () => {
  beforeEach(() => jest.clearAllMocks());

  test("uses session authentication and administrator authorization", () => {
    const { route } = setup();
    expect(route.middleware).toEqual([validatedRequest, mockAdminOnlyMiddleware]);
    expect(flexUserRoleValid).toHaveBeenCalledWith(["admin"]);
  });

  test("rejects invalid date ranges before querying the database", async () => {
    const { route, response } = setup();
    await route.handler({ query: { from: "invalid-date", to: "2026-10-16T00:00:00.000Z" } }, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(prisma.api_usage_events.aggregate).not.toHaveBeenCalled();
  });

  test("rejects a missing or reversed date range before querying the database", async () => {
    const { route, response } = setup();
    await route.handler({ query: { from: "2026-10-16T00:00:00.000Z", to: "2026-10-15T00:00:00.000Z" } }, response);
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
      requests: 6,
      completed: 4,
      failed: 1,
      successRate: 80,
      averageLatencyMs: 125,
    });
    expect(response.body.tokens).toEqual({ input: 10, output: 20, total: 30 });
    expect(response.body.estimatedCosts).toMatchObject({
      total: 0.12,
      eventsWithKnownCost: 2,
      coveragePercent: 33.33,
    });
    expect(response.body.dailyTrend).toEqual([
      {
        date: "2026-10-15",
        requests: 5,
        completed: 4,
        failed: 1,
        totalTokens: 30,
        knownCostEvents: 2,
        knownCostUsd: 0.12,
      },
    ]);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('GROUP BY strftime'),
      expect.any(String),
      expect.any(String)
    );
    expect(response.body.financials).toMatchObject({ revenue: null, profit: null });
    expect(response.body.platform).toEqual({
      totalUsers: 7,
      activeUsers: 6,
      totalWorkspaces: 3,
      totalApiKeys: 4,
    });
  });

  test("does not present unknown daily costs as zero-cost usage", async () => {
    mockSuccessfulQueries();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        date: "2026-10-15",
        requests: 2n,
        completed: 2n,
        failed: 0n,
        totalTokens: 0n,
        knownCostEvents: 0n,
        knownCostUsd: 0,
      },
    ]);
    const { route, response } = setup();
    await route.handler({ query: {} }, response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.body.dailyTrend[0]).toMatchObject({
      knownCostEvents: 0,
      knownCostUsd: null,
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
