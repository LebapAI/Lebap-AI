const prisma = require("../../../utils/prisma");
const { validatedRequest } = require("../../../utils/middleware/validatedRequest");
const { flexUserRoleValid, ROLES } = require("../../../utils/middleware/multiUserProtected");

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

function parseDate(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function businessAnalyticsEndpoints(app) {
  if (!app) return;

  app.get(
    "/admin/business-analytics",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
      const from = parseDate(request.query.from, defaultFrom);
      const to = parseDate(request.query.to, now);

      if (!from || !to || from >= to) {
        return response.status(400).json({
          error: "from and to must be valid dates and from must be earlier than to.",
        });
      }
      if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        return response.status(400).json({
          error: "The requested date range cannot exceed 366 days.",
        });
      }

      try {
        const range = { gte: from, lte: to };
        const [
          usageTotals,
          statusGroups,
          modelGroups,
          providerGroups,
          dailyTrendRows,
          knownCostTotals,
          totalUsers,
          activeUsers,
          totalWorkspaces,
          totalApiKeys,
        ] = await Promise.all([
          prisma.api_usage_events.aggregate({
            where: { createdAt: range },
            _count: { _all: true },
            _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
            _avg: { latencyMs: true },
          }),
          prisma.api_usage_events.groupBy({
            by: ["status"],
            where: { createdAt: range },
            _count: { _all: true },
          }),
          prisma.api_usage_events.groupBy({
            by: ["model"],
            where: { createdAt: range },
            _count: { _all: true },
            _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),
          prisma.api_usage_events.groupBy({
            by: ["provider"],
            where: { createdAt: range },
            _count: { _all: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
          }),
          // Aggregate in SQLite rather than loading every event into Node. Date
          // conversion handles both Prisma ISO timestamps and SQLite CURRENT_TIMESTAMP.
          prisma.$queryRawUnsafe(
            `SELECT
              strftime('%Y-%m-%d', datetime("createdAt")) AS "date",
              COUNT(*) AS "requests",
              SUM(CASE WHEN "status" = 'completed' THEN 1 ELSE 0 END) AS "completed",
              SUM(CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END) AS "failed",
              COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
              SUM(CASE WHEN "estimatedCostUsd" IS NOT NULL AND "costSource" <> 'unknown' THEN 1 ELSE 0 END) AS "knownCostEvents",
              SUM(CASE WHEN "estimatedCostUsd" IS NOT NULL AND "costSource" <> 'unknown' THEN "estimatedCostUsd" ELSE 0 END) AS "knownCostUsd"
            FROM "api_usage_events"
            WHERE datetime("createdAt") >= datetime(?) AND datetime("createdAt") <= datetime(?)
            GROUP BY strftime('%Y-%m-%d', datetime("createdAt"))
            ORDER BY "date" ASC`,
            from.toISOString(),
            to.toISOString()
          ),
          prisma.api_usage_events.aggregate({
            where: {
              createdAt: range,
              costSource: { not: "unknown" },
              estimatedCostUsd: { not: null },
            },
            _count: { _all: true },
            _sum: { estimatedCostUsd: true },
          }),
          prisma.users.count(),
          prisma.users.count({ where: { suspended: 0 } }),
          prisma.workspaces.count(),
          prisma.api_keys.count(),
        ]);

        const byStatus = Object.fromEntries(
          statusGroups.map((row) => [row.status, row._count._all])
        );
        const knownCostEvents = knownCostTotals._count._all || 0;
        const terminalRequests =
          (byStatus.completed || 0) + (byStatus.failed || 0) + (byStatus.aborted || 0);

        return response.status(200).json({
          range: { from: from.toISOString(), to: to.toISOString() },
          activity: {
            requests: usageTotals._count._all || 0,
            completed: byStatus.completed || 0,
            failed: byStatus.failed || 0,
            aborted: byStatus.aborted || 0,
            inProgress: byStatus.started || 0,
            successRate:
              terminalRequests > 0
                ? Number(((byStatus.completed || 0) / terminalRequests * 100).toFixed(2))
                : null,
            averageLatencyMs:
              usageTotals._avg.latencyMs === null
                ? null
                : Math.round(usageTotals._avg.latencyMs),
          },
          tokens: {
            input: usageTotals._sum.inputTokens || 0,
            output: usageTotals._sum.outputTokens || 0,
            total: usageTotals._sum.totalTokens || 0,
          },
          estimatedCosts: {
            currency: "USD",
            total: knownCostTotals._sum.estimatedCostUsd ?? null,
            eventsWithKnownCost: knownCostEvents,
            // Null is intentional: unknown-cost events must never be represented as free.
            coveragePercent:
              (usageTotals._count._all || 0) > 0
                ? Number((knownCostEvents / usageTotals._count._all * 100).toFixed(2))
                : 0,
          },
          topModels: modelGroups.map((row) => ({
            model: row.model || "unknown",
            requests: row._count._all,
            inputTokens: row._sum.inputTokens || 0,
            outputTokens: row._sum.outputTokens || 0,
            totalTokens: row._sum.totalTokens || 0,
          })),
          topProviders: providerGroups.map((row) => ({
            provider: row.provider || "unknown",
            requests: row._count._all,
          })),
          dailyTrend: dailyTrendRows.map((row) => {
            const knownDailyCostEvents = Number(row.knownCostEvents || 0);
            return {
              date: row.date,
              requests: Number(row.requests || 0),
              completed: Number(row.completed || 0),
              failed: Number(row.failed || 0),
              totalTokens: Number(row.totalTokens || 0),
              knownCostEvents: knownDailyCostEvents,
              // Null means no verified cost data for the day, not a free day.
              knownCostUsd: knownDailyCostEvents > 0 ? Number(row.knownCostUsd || 0) : null,
            };
          }),
          platform: {
            totalUsers,
            activeUsers,
            totalWorkspaces,
            totalApiKeys,
          },
          financials: {
            revenue: null,
            profit: null,
            note: "Revenue and profit are unavailable until billing and non-AI operating costs are integrated.",
          },
          dataQuality: {
            usageLedgerEnabled: process.env.ENABLE_API_USAGE_METERING === "true",
            note: "Usage values reflect recorded API events only; historical and unmetered operations are not included.",
          },
        });
      } catch (_error) {
        console.error("Business analytics query failed. Verify database migration and generated Prisma Client.");
        return response.status(503).json({
          error: "Business analytics are temporarily unavailable. The usage-ledger migration may not be applied.",
        });
      }
    }
  );
}

module.exports = { businessAnalyticsEndpoints };
