-- Add an optional workspace allowlist to API credentials.
-- NULL preserves compatibility for existing administrator/service keys.
ALTER TABLE "api_keys" ADD COLUMN "workspaceSlugs" TEXT;
