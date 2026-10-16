-- Add a nullable verifier column for newly issued API credentials.
-- Existing raw secrets remain in place during the compatibility rollout.
ALTER TABLE "api_keys" ADD COLUMN "secretHash" TEXT;
CREATE UNIQUE INDEX "api_keys_secretHash_key" ON "api_keys"("secretHash");
