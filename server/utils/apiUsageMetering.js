function usageMeteringEnabled() {
  return process.env.ENABLE_API_USAGE_METERING === "true";
}

function usageMetricsFromChatResult(chatResult) {
  const usage = chatResult?.usage ?? {};
  const pickCount = (...keys) => {
    for (const key of keys) {
      const value = usage[key];
      if (Number.isSafeInteger(value) && value >= 0) return value;
    }
    return undefined;
  };
  return {
    inputTokens: pickCount("prompt_tokens", "promptTokens", "input_tokens", "inputTokens"),
    outputTokens: pickCount("completion_tokens", "completionTokens", "output_tokens", "outputTokens"),
    totalTokens: pickCount("total_tokens", "totalTokens"),
    costSource: "unknown",
  };
}

module.exports = { usageMeteringEnabled, usageMetricsFromChatResult };
