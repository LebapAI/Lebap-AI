CREATE TABLE "api_usage_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" TEXT NOT NULL,
    "apiKeyId" INTEGER,
    "route" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "provider" TEXT,
    "model" TEXT,
    "workspaceSlug" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" REAL,
    "costCurrency" TEXT NOT NULL DEFAULT 'USD',
    "costSource" TEXT NOT NULL DEFAULT 'unknown',
    "errorCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "api_usage_events_requestId_key" ON "api_usage_events"("requestId");
CREATE INDEX "api_usage_events_apiKeyId_createdAt_idx" ON "api_usage_events"("apiKeyId", "createdAt");
CREATE INDEX "api_usage_events_createdAt_idx" ON "api_usage_events"("createdAt");
CREATE INDEX "api_usage_events_status_createdAt_idx" ON "api_usage_events"("status", "createdAt");
