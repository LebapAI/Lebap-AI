-- Persist per-key fixed-window request counters so limits survive restarts and are shared across instances.
CREATE TABLE "api_key_rate_limit_windows" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "apiKeyId" INTEGER NOT NULL,
  "windowStart" INTEGER NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "api_key_rate_limit_windows_apiKeyId_windowStart_key" ON "api_key_rate_limit_windows"("apiKeyId", "windowStart");
CREATE INDEX "api_key_rate_limit_windows_windowStart_idx" ON "api_key_rate_limit_windows"("windowStart");
