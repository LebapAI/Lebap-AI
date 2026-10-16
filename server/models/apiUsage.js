const prisma = require("../utils/prisma");

const TERMINAL_STATUSES = new Set(["completed", "failed", "aborted"]);
const USAGE_FIELDS = [
  "provider",
  "model",
  "workspaceSlug",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "estimatedCostUsd",
  "costCurrency",
  "costSource",
  "errorCategory",
];

function optionalNonNegativeInteger(value, field) {
  if (value === undefined || value === null) return value ?? null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

const ApiUsage = {
  /**
   * Create a minimal start event before invoking a provider.
   * Caller must supply a server-generated request ID; prompts and credentials
   * are deliberately not accepted as fields.
   */
  createStarted: async function ({
    requestId,
    apiKeyId = null,
    route,
    operation,
    provider = null,
    model = null,
    workspaceSlug = null,
  } = {}) {
    if (typeof requestId !== "string" || requestId.trim().length === 0) {
      throw new TypeError("requestId is required");
    }
    if (typeof route !== "string" || route.trim().length === 0) {
      throw new TypeError("route is required");
    }
    if (typeof operation !== "string" || operation.trim().length === 0) {
      throw new TypeError("operation is required");
    }
    if (apiKeyId !== null && (!Number.isSafeInteger(apiKeyId) || apiKeyId < 1)) {
      throw new TypeError("apiKeyId must be a positive safe integer or null");
    }

    return prisma.api_usage_events.create({
      data: {
        requestId: requestId.trim(),
        apiKeyId,
        route: route.trim(),
        operation: operation.trim(),
        status: "started",
        provider,
        model,
        workspaceSlug,
      },
    });
  },

  /**
   * Finalize a started event exactly once. The conditional update makes
   * duplicate finalization attempts harmless under concurrent callers.
   * Provider cost is optional and must be supplied only with explicit provenance.
   */
  finalize: async function ({ requestId, status, ...usage } = {}) {
    if (typeof requestId !== "string" || requestId.trim().length === 0) {
      throw new TypeError("requestId is required");
    }
    if (!TERMINAL_STATUSES.has(status)) {
      throw new TypeError("status must be completed, failed, or aborted");
    }

    const data = { status, finishedAt: new Date() };
    if (usage.latencyMs !== undefined) {
      data.latencyMs = optionalNonNegativeInteger(usage.latencyMs, "latencyMs");
    }
    for (const field of ["inputTokens", "outputTokens", "totalTokens"]) {
      if (usage[field] !== undefined) {
        data[field] = optionalNonNegativeInteger(usage[field], field);
      }
    }
    if (usage.estimatedCostUsd !== undefined) {
      const cost = usage.estimatedCostUsd;
      if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0)) {
        throw new TypeError("estimatedCostUsd must be a non-negative finite number or null");
      }
      data.estimatedCostUsd = cost;
    }
    for (const field of USAGE_FIELDS) {
      if (
        !["inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd"].includes(field) &&
        usage[field] !== undefined
      ) {
        data[field] = usage[field];
      }
    }

    const result = await prisma.api_usage_events.updateMany({
      where: { requestId: requestId.trim(), status: "started" },
      data,
    });
    return result.count === 1;
  },
};

module.exports = { ApiUsage };
