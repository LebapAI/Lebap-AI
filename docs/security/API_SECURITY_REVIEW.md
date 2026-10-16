# Lebap AI — API Security Review

Reviewed: 2026-10-16
Branch: `lebap-ai/development`

## Confirmed findings

### API key lookup behavior
- `server/utils/middleware/validApiKey.js` accepts a single explicit `Authorization: Bearer <token>` value and does not log or echo the token.
- `server/models/apiKeys.js` currently catches Prisma lookup exceptions in `ApiKey.get()` and returns `null`.
- The middleware uses `ApiKey.get()`, so an unknown token and a database lookup failure are currently indistinguishable at the HTTP response layer.
- Required remediation: add a strict lookup method that lets Prisma errors propagate; use it only in authentication middleware; preserve the existing `get()` contract for other call sites. A lookup exception should produce a generic 500 response and must not expose error details.

### API key data model
- Prisma model `api_keys` has a unique nullable `secret`, optional `name`, optional `createdBy`, and timestamps.
- There are no fields in this model for expiry, revocation status, scopes, last-used time, or usage limits.
- Do not add these fields or a migration until all key creation, deletion, authentication, and API route call sites have been mapped.

### Persistence configuration
- The checked-in Prisma schema defaults to SQLite at `file:../storage/anythingllm.db`.
- A PostgreSQL datasource is documented in comments but is not active in this schema.
- Any deployment plan that assumes PostgreSQL must explicitly verify the active schema, migration process, and production environment configuration before claiming PostgreSQL support.

## Next implementation sequence

1. Implement strict authentication lookup and add a database-error test.
2. Run focused tests and lint in a real checkout; record exact results.
3. Inventory every API-key creation/read/delete call site and protected API route.
4. Design usage tracking and quotas only after route identity, tenant/workspace ownership, and failure semantics are clear.
5. Introduce schema changes with a reviewed migration and backward-compatibility plan.

## Verification limitations

This review was based on reading the current files through the GitHub connector. Jest, ESLint, Prisma validation, and application builds were not run in this session. Findings are source inspection, not runtime verification.
