# Lebap AI — API Route Review

**Reviewed:** 2026-10-17  
**Branch:** `lebap-ai/organized`  
**Scope:** static inspection of route registration and related middleware; no live requests were executed.

## Route families observed

The API router registers authentication, admin, system, workspace, document, workspace-thread, user-management, OpenAI-compatible, embed, and API-key management route groups. Middleware is applied in route groups and individual route declarations; a router-level comment alone is not proof of global enforcement.

## Controls observed in source

- API-key authentication requires an explicit Bearer credential and checks expiry/revocation.
- Shared workspace-scope helpers are used in API-key authentication and selected OpenAI-compatible operations.
- Model and vector-store listing paths include workspace filtering.
- Privileged system routes use administrator-owned-key authorization.
- API-key management routes include validation and tests for lifecycle/scope behavior.
- A shared API-key request rate limiter exists in source; deployment semantics and complete route coverage remain unverified.

## Coverage still requiring verification

1. Enumerate every registered route and HTTP method, including nested routers and mounted sub-apps.
2. Classify each route as public, session-authenticated, API-key-authenticated, administrator-only, or workspace-scoped.
3. Confirm middleware ordering and fail-closed behavior on every privileged and data-access route.
4. Confirm the authenticated key's allowlist is checked before provider calls, database reads, vector/document operations, and response serialization.
5. Add/maintain route-level tests for denied access, revoked/expired keys, missing owner, malformed scope, and unexpected database failures.
6. Test rate-limit behavior for all intended protected route families and verify the limiter cannot be bypassed through alternate paths.
7. Normalize external errors and ensure raw provider/internal exceptions, secrets, and sensitive content are not returned or logged.

## Verification boundary

This is not an exhaustive automated route proof, runtime integration test, load test, or penetration test. Production readiness must remain blocked until the route inventory and required test suites are complete.

## Focused source audit — 2026-10-20

The following observations were confirmed by reading the current route and middleware source. They are not runtime verification.

- Developer API route groups are registered in `server/endpoints/api/index.js`: auth, admin, system, workspace, document, workspace-thread, user-management, OpenAI-compatible, embed, and API-key management.
- `validApiKey` validates Bearer credentials, expiry/revocation, workspace scope, and the shared database-backed rate limiter. Rate-limit storage failures return 503 (fail closed); rejected requests return 429.
- Privileged route families generally chain `apiKeyOwnerIsAdmin` after authentication. That middleware checks that the key has an active administrator owner and denies workspace-scoped keys except for the two explicitly supported OpenAI chat/model routes.
- The OpenAI chat handler separately checks the requested model/workspace slug against the API key's allowlist. The model-list handler filters returned workspaces by the same allowlist.
- Workspace-scoped keys are not a universal route-scoping system: they are intentionally denied by the admin-owner middleware on most route families. Document metadata endpoints are treated as safe static metadata by the workspace-scope helper.
- **Legacy scope risk remains:** a database `workspaceSlugs = NULL` is interpreted as unrestricted for backward compatibility. This must be inventoried and migrated/rotated deliberately; changing NULL to deny-all without a rollout plan could break existing integrations.
- **Operational limitation:** the limiter depends on the configured Prisma database. Its unit tests mock the Prisma client, so they do not establish cross-process behavior, production database semantics, or concurrent request correctness under load.
- **Unverified:** complete method-by-method route coverage, live authorization tests against a real database, migration execution, concurrency/load tests, tenant isolation, and end-to-end provider request behavior.

## Required next actions

1. Generate a route/method inventory from registered Express routes and verify every route has an explicit authorization classification.
2. Add integration tests for each route family covering missing, expired, revoked, ownerless, suspended-owner, unrestricted legacy, and explicit workspace-scoped keys.
3. Decide and document the deprecation/rotation path for legacy NULL-scope keys before changing their semantics.
4. Run migrations and rate-limit concurrency tests against a disposable instance of each supported database configuration.
5. Re-run the full CI suite on the exact current branch head and attach the results before release.

