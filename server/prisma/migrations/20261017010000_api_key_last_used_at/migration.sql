-- Track the most recent successful authentication for credential auditing.
ALTER TABLE "api_keys" ADD COLUMN "lastUsedAt" DATETIME;
