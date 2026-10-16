-- Add nullable lifecycle fields so existing API keys remain valid without a forced reissue.
ALTER TABLE "api_keys" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "api_keys" ADD COLUMN "revokedAt" DATETIME;
