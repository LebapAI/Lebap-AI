const prisma = require("../utils/prisma");
const { ApiUsage } = require("./apiUsage");

jest.mock("../utils/prisma", () => ({
  api_usage_events: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe("API usage ledger model", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates a minimal started event without accepting prompt or secret fields", async () => {
    prisma.api_usage_events.create.mockResolvedValue({ id: 1, status: "started" });

    await ApiUsage.createStarted({
      requestId: "req-123",
      apiKeyId: 7,
      route: "/v1/openai/chat/completions",
      operation: "chat.completion",
      provider: "openai",
      model: "model-a",
      workspaceSlug: "workspace-a",
      prompt: "must not be persisted",
      secret: "must not be persisted",
    });

    expect(prisma.api_usage_events.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-123",
        apiKeyId: 7,
        route: "/v1/openai/chat/completions",
        operation: "chat.completion",
        status: "started",
        provider: "openai",
        model: "model-a",
        workspaceSlug: "workspace-a",
      },
    });
    expect(JSON.stringify(prisma.api_usage_events.create.mock.calls)).not.toContain("must not be persisted");
  });

  test.each([
    [{ route: "/v1/openai/chat/completions", operation: "chat.completion" }, /requestId is required/],
    [{ requestId: "req-1", operation: "chat.completion" }, /route is required/],
    [{ requestId: "req-1", route: "/v1/openai/chat/completions" }, /operation is required/],
    [{ requestId: "req-1", route: "/x", operation: "chat", apiKeyId: 0 }, /apiKeyId/],
  ])("validates required start-event fields (%p)", async (input, error) => {
    await expect(ApiUsage.createStarted(input)).rejects.toThrow(error);
    expect(prisma.api_usage_events.create).not.toHaveBeenCalled();
  });

  test("finalizes a started event with provider usage and explicit cost provenance", async () => {
    prisma.api_usage_events.updateMany.mockResolvedValue({ count: 1 });

    const finalized = await ApiUsage.finalize({
      requestId: "req-123",
      status: "completed",
      latencyMs: 1200,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.002,
      costCurrency: "USD",
      costSource: "provider-reported",
    });

    expect(finalized).toBe(true);
    const query = prisma.api_usage_events.updateMany.mock.calls[0][0];
    expect(query.where).toEqual({ requestId: "req-123", status: "started" });
    expect(query.data).toMatchObject({
      status: "completed",
      latencyMs: 1200,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.002,
      costCurrency: "USD",
      costSource: "provider-reported",
    });
    expect(query.data.finishedAt).toBeInstanceOf(Date);
  });

  test("returns false if an event was already finalized", async () => {
    prisma.api_usage_events.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      ApiUsage.finalize({ requestId: "req-123", status: "completed" })
    ).resolves.toBe(false);
  });

  test.each([
    [{ requestId: "req-123", status: "started" }, /status must be/],
    [{ requestId: "req-123", status: "failed", inputTokens: -1 }, /inputTokens/],
    [{ requestId: "req-123", status: "failed", latencyMs: 1.5 }, /latencyMs/],
    [{ requestId: "req-123", status: "failed", estimatedCostUsd: Infinity }, /estimatedCostUsd/],
  ])("rejects invalid finalization payloads (%p)", async (input, error) => {
    await expect(ApiUsage.finalize(input)).rejects.toThrow(error);
    expect(prisma.api_usage_events.updateMany).not.toHaveBeenCalled();
  });
});
