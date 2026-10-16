const {
  usageMeteringEnabled,
  usageMetricsFromChatResult,
} = require("./apiUsageMetering");

describe("API usage metering helpers", () => {
  const originalFlag = process.env.ENABLE_API_USAGE_METERING;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ENABLE_API_USAGE_METERING;
    else process.env.ENABLE_API_USAGE_METERING = originalFlag;
  });

  test("metering is disabled unless explicitly enabled", () => {
    delete process.env.ENABLE_API_USAGE_METERING;
    expect(usageMeteringEnabled()).toBe(false);
    process.env.ENABLE_API_USAGE_METERING = "false";
    expect(usageMeteringEnabled()).toBe(false);
    process.env.ENABLE_API_USAGE_METERING = "true";
    expect(usageMeteringEnabled()).toBe(true);
  });

  test("normalizes recognized non-negative token counters", () => {
    expect(usageMetricsFromChatResult({
      usage: { prompt_tokens: 12, completionTokens: 7, total_tokens: 19 },
    })).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      totalTokens: 19,
      costSource: "unknown",
    });
  });

  test("ignores invalid token counters and never infers cost", () => {
    expect(usageMetricsFromChatResult({
      usage: { prompt_tokens: -1, completion_tokens: 2.5, total_tokens: "3" },
    })).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
      costSource: "unknown",
    });
  });

  test("returns only approved usage fields", () => {
    expect(usageMetricsFromChatResult({
      prompt: "ignored",
      usage: { inputTokens: 4 },
    })).toEqual({
      inputTokens: 4,
      outputTokens: undefined,
      totalTokens: undefined,
      costSource: "unknown",
    });
  });
});
