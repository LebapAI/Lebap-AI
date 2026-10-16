const prisma = require("../utils/prisma");
const {
  configuredRequestsPerMinute,
  consumeApiKeyRateLimit,
} = require("./apiKeyRateLimiter");

jest.mock("../utils/prisma", () => ({
  api_key_rate_limit_windows: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

describe("API key rate limiter", () => {
  const originalLimit = process.env.API_KEY_RATE_LIMIT_PER_MINUTE;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.api_key_rate_limit_windows.deleteMany.mockResolvedValue({ count: 0 });
    delete process.env.API_KEY_RATE_LIMIT_PER_MINUTE;
  });

  afterAll(() => {
    if (originalLimit === undefined) delete process.env.API_KEY_RATE_LIMIT_PER_MINUTE;
    else process.env.API_KEY_RATE_LIMIT_PER_MINUTE = originalLimit;
  });

  test("defaults to a documented, bounded request rate", () => {
    expect(configuredRequestsPerMinute()).toBe(120);
    process.env.API_KEY_RATE_LIMIT_PER_MINUTE = "45";
    expect(configuredRequestsPerMinute()).toBe(45);
  });

  test.each(["0", "-1", "1.5", "many", "100001"])(
    "rejects an invalid configured rate %p",
    (value) => {
      expect(() => configuredRequestsPerMinute(value)).toThrow(/integer between 1 and 100000/);
    }
  );

  test("atomically increments a key's current minute counter", async () => {
    prisma.api_key_rate_limit_windows.upsert.mockResolvedValue({ requestCount: 2 });
    const now = Date.UTC(2026, 9, 17, 12, 34, 20);
    const result = await consumeApiKeyRateLimit(7, now, 3);
    const windowStart = Math.floor(now / 60000);

    expect(prisma.api_key_rate_limit_windows.upsert).toHaveBeenCalledWith({
      where: { apiKeyId_windowStart: { apiKeyId: 7, windowStart } },
      create: { apiKeyId: 7, windowStart, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
    });
    expect(result).toEqual({
      allowed: true,
      limit: 3,
      remaining: 1,
      resetAt: (windowStart + 1) * 60000,
      retryAfterSeconds: 40,
    });
  });

  test("rejects requests after the limit is reached", async () => {
    prisma.api_key_rate_limit_windows.upsert.mockResolvedValue({ requestCount: 4 });
    const now = Date.UTC(2026, 9, 17, 12, 34, 59);
    const result = await consumeApiKeyRateLimit(7, now, 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBe(1);
  });

  test.each([
    [0, 100, 3],
    [7, -1, 3],
    [7, 100, 0],
  ])("validates rate-limit inputs (%p, %p, %p)", async (keyId, now, limit) => {
    await expect(consumeApiKeyRateLimit(keyId, now, limit)).rejects.toThrow();
    expect(prisma.api_key_rate_limit_windows.upsert).not.toHaveBeenCalled();
  });

  test("does not hide database failures", async () => {
    prisma.api_key_rate_limit_windows.upsert.mockRejectedValue(new Error("db unavailable"));
    await expect(consumeApiKeyRateLimit(7, 100, 3)).rejects.toThrow("db unavailable");
  });
});
