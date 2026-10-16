# Lebap AI — API Security Review

Reviewed: 2026-10-16
Branch: `lebap-ai/development`

## Current controls verified by source inspection

### API-key authentication and lifecycle

- `server/utils/middleware/validApiKey.js` accepts only a single explicit `Authorization: Bearer <token>` value and does not log or echo the credential.
- `server/models/apiKeys.js` hashes newly issued high-entropy API secrets with SHA-256 and authenticates by hash; exact-match lookup remains for legacy records that still store raw secrets.
- Expiry and revocation are checked by the authentication middleware. Revocation is soft, preserving the record for audit/history.
- A strict authentication lookup is used so database lookup failures can produce a generic 500 response rather than being mistaken for an unknown key.
- The middleware attaches only non-secret key metadata to `response.locals.apiKey`.
- New keys issued through `POST /v1/admin/api-keys` require a non-empty allowlist of existing workspace slugs (up to 100, no duplicates). The raw secret is returned once at creation and excluded from listing responses.
- Workspace scope parsing fails closed for empty or malformed stored values. Only SQL NULL/undefined retains the legacy unrestricted compatibility behavior.
- `server/endpoints/api/openai/index.js` filters model listing and checks the requested workspace for chat completion. Scoped keys are denied by `apiKeyOwnerIsAdmin` on privileged routes other than the two explicitly permitted OpenAI-compatible routes.
- `apiKeyOwnerIsAdmin` requires an API key owned by an existing, active administrator and fails closed on missing ownership or authorization lookup errors.

## Known gaps and risks

1. **Legacy unrestricted keys:** Existing keys with NULL `workspaceSlugs` retain broad access for compatibility. Inventory and rotate them to explicit workspace scopes before treating this as tenant isolation.
2. **Legacy plaintext secrets:** Existing raw-secret records are still accepted by the compatibility lookup. Plan a controlled rotation/migration and remove plaintext credentials from storage after consumers have switched.
3. **Route coverage:** Privileged API routes have been guarded in several route groups, but the full route inventory still requires a systematic review for unguarded routes, unexpected middleware ordering, and indirect access paths. Do not infer complete coverage from the listed changes.
4. **No usage ledger or budget enforcement:** Per-key usage metering, quotas, rate limiting, and provider-spend controls are not implemented as a verified end-to-end system.
5. **No tenant/client identity model:** Workspace allowlists restrict newly issued API keys for the supported OpenAI-compatible endpoints, but there is not yet a complete client/tenant identity and authorization model across all product APIs.
6. **Migration and runtime verification:** The schema changes and migrations are committed but have not been applied here. Prisma Client generation, Jest, lint, build, migration checks, and runtime API tests have not been executed in this session. CI status checks returned no reported statuses for the checked commits; this is not evidence that tests passed.

## Next remediation order

1. Inventory every route mounted under the API router and classify it as public, key-authenticated, administrator-only, or workspace-scoped. Verify middleware order and tests for every class.
2. Add regression tests for scoped-key denial across every non-allowlisted route family and verify requested workspace IDs/slugs are checked before provider or storage work.
3. Design persistent usage metering and rate/spend limits with atomic accounting, explicit failure behavior, and a reviewed migration.
4. Rotate legacy unrestricted and plaintext-secret keys; document the migration path and rollback constraints.
5. Run Prisma validation/client generation, focused tests, the full server test suite, lint, build, migrations, and runtime API tests in CI or a real checkout before production deployment.

## Verification boundary

This document records source-level review only. It is not a penetration-test report, passing-CI claim, or production-readiness approval.


## API usage accounting status — 2026-10-16

A durable usage ledger schema and model have been committed, but request handlers do not yet write usage events. It must not be treated as active metering, billing, rate limiting, or spend enforcement. The SQLite migration and Prisma Client generation remain unapplied, and automated tests/build/lint are unverified. See `docs/architecture/API_HUB_USAGE_METERING.md` for the current design and staged rollout criteria.
