# Lebap AI — Historical API Security and Route Review Notes

This archive preserves earlier security-review snapshots. Older findings may be superseded by later source changes. Use the current `docs/security/API_SECURITY_REVIEW.md`, `docs/security/API_ROUTE_REVIEW.md`, and `docs/architecture/API_HUB_USAGE_METERING.md` for the current documented status.

---

## Previous API security review

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

## API-key creation scope UX follow-up — 2026-10-16

- The API-key creation dialog now requires selecting one or more workspaces and sends an explicit allowlist. Both multi-user admin and single-user routes validate the supplied slugs against existing workspaces.
- Backward compatibility remains for older clients that omit the scope field; such calls still receive the legacy default of all currently existing workspaces. This compatibility path should be removed after all clients are upgraded.
- Existing NULL-scope credentials are still unrestricted. Rotate them or explicitly migrate their scope before treating least-privilege as complete.
- Frontend build and automated validation of the latest changes are pending.


---

## Previous API route review

# API Route Review — Lebap AI

Review date: 2026-10-16  
Reviewed branch: `lebap-ai/development`  
Scope: source inspection of the API router and OpenAI-compatible endpoints. This is a static review; no endpoint was executed.

## Confirmed findings

### 1. Existing developer API routes are registered as a group

`server/endpoints/api/index.js` registers the auth, admin, system, workspace, document, workspace-thread, user-management, OpenAI-compatible, and embed endpoint groups. Its comment states that all endpoints must pass through `validApiKey`, but this file itself does not attach the middleware globally; enforcement must therefore be verified at each route declaration or in the parent router mounting code.

### 2. OpenAI-compatible endpoints currently have no visible tenant/credential context

In `server/endpoints/api/openai/index.js`, `/v1/openai/models` and `/v1/openai/vector_stores` enumerate all workspaces returned by `Workspace.where()`. Chat completion resolves the workspace from the client-supplied model slug. The middleware validates that a key exists, but the inspected code does not bind that key to a tenant, scope, workspace allowlist, rate limit, or spend quota.

Impact: current API keys behave as application-wide credentials for these routes rather than tenant-scoped platform credentials. Do not expose these routes to untrusted external tenants until authorization boundaries are implemented and tested.

### 3. Provider-facing operations do not record platform usage events in the inspected route

The chat-completion path sends general telemetry and writes an event log, but the reviewed route does not persist a normalized per-request usage record with credential/tenant attribution, request ID, provider-reported token usage, latency, estimated cost, and billing provenance. Embedding and image generation paths similarly do not show a common usage-accounting layer in this file.

Impact: reliable quotas, hard spend limits, per-client billing, and usage analytics cannot be implemented from the existing event logs alone without additional data and enforcement.

### 4. Some public error responses expose internal/provider messages

The image generation route returns `{ error: e.message }` on caught failures. Other routes often return an empty 500 response. Provider or internal exception messages can contain implementation details and are not a stable public error contract.

Recommendation: log detailed exceptions only on the server with a request/correlation ID; return a stable public error code/message and never return stack traces, secrets, or raw provider exceptions.

### 5. Streaming and expensive operations need explicit operational limits

Chat streaming and image generation call provider-backed operations. The inspected route does not show a shared API Hub layer applying per-client concurrency, rate, request-size, execution-time, or spend controls before provider invocation. The image handler supports client disconnect cancellation, which is useful, but does not replace quotas or provider-side timeout policy.

## Recommended implementation order

1. Map the parent router mounting and verify every developer API route is behind authentication; add automated route-level coverage.
2. Define tenant/client identity and credential ownership. Do not infer ownership from the existence of an API key alone.
3. Add a request context with generated request ID, credential ID, tenant ID, start time, and safe audit metadata.
4. Implement server-side rate/concurrency limits and pre-call quota/spend checks before enabling external tenants.
5. Add a normalized usage-event model and persistence strategy, distinguishing provider-reported usage, estimated cost, actual provider billing, and customer charge.
6. Normalize error responses, including image-generation failures, while preserving detailed server-side diagnostics without logging credentials or sensitive prompts.
7. Add tests for tenant isolation, invalid/disabled credentials, quotas, provider failures, streaming disconnects, and usage accounting.

## Not verified

- Whether parent router mounting adds global middleware or other access controls.
- Whether provider libraries enforce timeouts internally.
- Whether separate code paths record usage not visible in the reviewed file.
- Any runtime behavior, tests, load behavior, or deployment configuration.

These unknowns must be inspected or tested before making production-readiness claims.

### 6. Production environment-dump route lacked safe behavior

In `server/endpoints/api/system/index.js`, `GET /v1/system/env-dump` had a production path that called `dumpENV()`. Commit `9b86a9aa464f7d6da2bdf29fe43f1f5e3e5e5525` disables that direct action in production and returns HTTP 404.

**Priority: high — targeted remediation committed.** Production environment persistence through the separate `updateENV()` path was not changed by this remediation.

## Follow-up remediation — system response redaction

- Commit `f65397f106221dba22104184892d9d7111bda464` sanitizes likely secret fields returned by `POST /v1/system/update-env`.
- Commit `448567fb7466fa18efad4efa5111f51d484d8195` applies the same response-boundary sanitizer to `GET /v1/system` and the update response. Fields with names matching key, token, secret, password, connection-string, auth, credential, or private-key patterns are replaced with boolean presence indicators.
- Static source verification only; tests, lint, build, and runtime behavior have not been executed in this session.
- The earlier image-generation error-response finding was remediated in the current route: detailed exceptions are logged server-side and a generic response is returned.

## Follow-up finding — API key ownership and tenant isolation

- The API-key model stores `createdBy`, `name`, workspace allowlist, expiry, and revocation state; `getForAuthentication()` retrieves the matching key record. The current `validApiKey` middleware validates the bearer secret and attaches non-secret key identity and parsed scope metadata to request context.
- Follow-up remediation now intersects OpenAI-compatible chat/model/vector-store routes with the key's workspace allowlist. Legacy NULL scopes remain unrestricted for backward compatibility; malformed explicit scopes fail closed.
- This does **not** establish whether parent middleware or other runtime controls add protection; those paths remain to be inspected. It does establish that tenant authorization is not visible in the reviewed endpoint implementation.
- Do not add an ownership restriction based only on `createdBy` until legacy-key behavior, key-creation semantics, and admin/service-key expectations are confirmed. A rushed filter could break existing installations or grant misleading partial isolation.
- Next implementation gate: trace where API keys are created/deleted and how workspace permissions are enforced; then add explicit credential scope/tenant authorization plus regression tests before enabling third-party tenants.

## Remediation status — Simple SSO token issuance

The route `GET /v1/users/:id/issue-auth-token` was updated to require a key whose `createdBy` user is an active administrator. The API-key middleware attaches only non-secret metadata (`id`, `createdBy`, `name`) to `response.locals.apiKey`. This is a targeted fix, not a global authorization solution. Verify API-key lifecycle compatibility and run automated tests before production use. Commits `230bd6340cd7e208bfa2b5d5509741d9f51ed3f3` and `4eedcbe09b1e5c60750a28df0d6b15497d3ddade`.


## Follow-up — parent router and API key schema confirmed

- `server/index.js` mounts `apiRouter` at `/api` without a global API-key or role middleware. `developerEndpoints(app, apiRouter)` registers API groups on the router; therefore route-level middleware is the relevant control unless another route-specific layer is present.
- The current Prisma `api_keys` model includes `secretHash`, `workspaceSlugs`, `expiresAt`, and `revokedAt` in addition to owner/name/timestamps. The original observation above is superseded by the lifecycle migration and follow-up implementation.
- OpenAI-compatible chat/model/vector-store routes now enforce the explicit workspace allowlist. This is credential-scoped workspace isolation, not a complete tenant/customer identity system.
- Legacy NULL workspace scopes remain unrestricted for compatibility. External tenant rollout still requires explicit migration/rotation of legacy keys, quotas, cost controls, and runtime verification.
- Do not describe this branch as production-ready for untrusted multi-tenant API customers until credential semantics, authorization, quotas, and regression tests are implemented and verified.


## Remediation — privileged API key owner checks (2026-10-16)

- Added `server/utils/middleware/apiKeyOwnerIsAdmin.js`. After bearer authentication, it requires `response.locals.apiKey.createdBy` to resolve to an active user with role `admin`; missing owners and non-admin/suspended owners receive HTTP 403. Lookup errors fail closed with a generic HTTP 500 response and are not logged with credential data.
- Applied the middleware to every route declared in `server/endpoints/api/admin/index.js` (13 route declarations) and to `GET /v1/users`. The Simple SSO token issuance route retains its equivalent targeted owner/admin check.
- Compatibility impact is intentional: legacy keys with no owner and keys owned by non-admins cannot call these privileged routes. Use an API key created by an active administrator.
- Static source verification confirms the admin module has no remaining route middleware declaration consisting only of `[validApiKey]`. This is not a runtime test.
- Still unresolved: per-key rate/concurrency/spend quotas, reliable provider-cost attribution, and complete tenant/customer identity. API key scopes, expiry, and revocation are implemented in the current branch; legacy NULL scopes remain unrestricted until rotated or explicitly scoped. Do not enable untrusted multi-tenant customers until the remaining controls are implemented and tested.


## Sensitive system operations — targeted authorization hardening

- Commit `8eb527b34d36d4bc1a2654bbf12703fca2ae253f` adds the shared `apiKeyOwnerIsAdmin` middleware to `POST /v1/system/update-env`, `GET /v1/system/export-chats`, and `DELETE /v1/system/remove-documents`.
- These routes can change system configuration, export system-wide chat data, or permanently delete documents. They now require an API key associated with an active administrator, in addition to a valid bearer key.
- This is a targeted change; other system routes and all other API groups still require a complete route-by-route authorization audit.
- Compatibility note: unowned legacy keys and keys owned by non-admin users will receive 403 for these three routes. Create an administrator-owned key for authorized automation.
- Source-level verification only; automated tests, lint, build, and runtime behavior have not been run.

## Follow-up remediation — thread and embed API route guards (2026-10-16)

- The workspace-thread API module previously used `validApiKey` alone on six routes that create, update, delete, or read workspace-thread data. Those route declarations now also require `apiKeyOwnerIsAdmin`.
- The embed developer API module previously used `validApiKey` alone for listing and managing embed configurations; all six route declarations now require `apiKeyOwnerIsAdmin`, including routes already guarded for chat-history access.
- Commits: `5ed71739714d170d4714cb2a1558330375569372` and `bb80c04a659bca1f37d9803af850d2ca80a95f04`.
- This is a temporary instance-admin boundary because the schema still lacks credential scopes and workspace allowlists. It does not provide tenant isolation and may break non-admin or legacy-key integrations. Replace it with explicit least-privilege scopes only after the credential lifecycle and workspace authorization model are implemented and tested.
- Static verification: fetched the updated files and checked all six route declarations in each module. Automated tests, lint, build, runtime tests, and regression checks have not been run.

## Follow-up remediation — document, workspace deletion, and image-generation routes (2026-10-16)

- All routes in `server/endpoints/api/document/index.js` now require `validApiKey` followed by `apiKeyOwnerIsAdmin`, including upload, link/raw-text ingestion, reads, folder/file mutations, and generated-file downloads. Multipart authorization is placed before file upload handling.
- Workspace deletion now requires an administrator-owned key before the existing deletion-protection middleware.
- OpenAI-compatible image generation now requires an administrator-owned key before upload/provider processing, reducing exposure to unauthorised provider spend until server-side quotas and client scopes exist.
- Commits: `d85c20830eb2d5e1f54a1a467aeec0147aa81bf0`, `c9f8181ec6314b2de62f1069309abf4c09ec71a8`, and `0f0f2a9570c8e79aea38f5ea6bf283e0d423fb55`.
- Compatibility impact: broad interim admin-only policy can block non-admin integrations, including legitimate external agents. Do not weaken this to key-only access until least-privilege credential scopes, workspace authorization, usage limits, and tests are implemented.
- Static source verification only. Automated tests, lint, build, runtime API checks, provider-call tests, and deployment checks remain unexecuted.


## API key management implementation follow-up — 2026-10-16

The developer API now registers `server/endpoints/api/apiKeys/index.js` with these administrator-guarded routes:

- `GET /v1/admin/api-keys` lists metadata only; the raw secret is excluded.
- `POST /v1/admin/api-keys` creates a key for the active administrator who owns the presented API key. The new secret is returned only once in the creation response.
- `DELETE /v1/admin/api-keys/:id` revokes a key after validating the ID and existence; the credential used for the current request cannot revoke itself.
- Creation/revocation attempts are recorded through the existing event log. Audit-write failure is best-effort so a successful credential mutation is not reported as an ambiguous failure.

A Jest test file was added for route guard registration, secret redaction, name validation, creation, self-revocation prevention, and revocation auditing. These tests have **not** been run. At the initial implementation stage, expiry and soft revocation were not present; the follow-up section below adds nullable expiry/revocation fields and enforcement. Scopes, tenant/workspace binding, hashing-at-rest, usage accounting, and quotas remain unimplemented. Do not treat this incremental change as production-ready credential governance.


## API credential lifecycle follow-up — expiry and soft revocation (2026-10-16)

- Added nullable `expiresAt` and `revokedAt` fields to the Prisma SQLite schema and a forward migration at `server/prisma/migrations/20261016150000_api_key_lifecycle/migration.sql`. Existing keys retain null values and remain valid after the migration.
- The key creation endpoint validates optional future ISO-8601 expiry dates; list responses show active/expired/revoked status without revealing secrets.
- `validApiKey` rejects credentials with `revokedAt` set or an expiry timestamp at/before the current time. The admin revocation route sets `revokedAt` instead of deleting the credential record.
- Tests were added for expiry validation and authentication rejection of expired/revoked keys. They have not been executed.
- The migration has not been applied and Prisma client generation has not been run. Do not assume the deployed database contains the new columns. Scopes, workspace/client binding, key hashing, rate limits and usage metering remain unimplemented.


## Follow-up review — workspace-scoped API credentials (2026-10-16)

The earlier findings above describe the state at the time of the initial review. Subsequent changes on this branch have partially remediated them:

- Newly issued keys require an explicit, non-empty list of existing workspace slugs and store a SHA-256 verifier rather than a raw secret.
- `/v1/openai/models` filters the model list to the key's allowlist, and `/v1/openai/chat/completions` checks the requested workspace before provider execution.
- `apiKeyOwnerIsAdmin` denies workspace-scoped keys on other guarded routes. The guard still requires an active administrator owner, including on the two permitted OpenAI-compatible routes.
- `/v1/openai/vector_stores`, embeddings, image generation, document operations, and other privileged routes are not intended to be available to workspace-scoped keys under the current guard. This depends on the guard being attached to the route and the Express route metadata being populated; runtime tests are still required.
- API-key metadata listing now fails closed for malformed stored workspace scope, matching authentication behavior.

The following original findings remain open: NULL-scoped legacy keys are unrestricted, legacy raw-secret records remain accepted, no normalized usage ledger or enforceable rate/spend limits exist, and a complete route-by-route authorization audit has not been finished. No tests, migration, build, or runtime checks have been executed here.


## Additional scope-bypass path closed — system information routes (2026-10-16)

- A route-by-route follow-up found `GET /v1/system/env-dump`, `GET /v1/system`, and `GET /v1/system/vector-count` had only `validApiKey`, not the shared administrator/scope guard. A workspace-scoped API key could therefore reach these routes despite the intended restriction to OpenAI-compatible model listing and chat.
- Added `apiKeyOwnerIsAdmin` to all three endpoints and added route-registration regression tests covering all six system API routes.
- Commits: `3242794ecd9b6d42e6570a630a1362af0852956d` and `c5c1ad25cc48e679541e4034b640a73a75494c7d`.
- This closes the identified system-route gap only. The full route inventory is still incomplete, and the tests have not been executed.


## Credential lifecycle edge case — invalid expiry values (2026-10-16)

A defensive edge case was found in expiry enforcement: a non-null expiry value that could not be parsed produced `NaN`, and the previous comparison did not classify it as expired. Authentication now rejects invalid expiry values as well as expired/revoked keys. The public key metadata status also reports malformed expiry as `expired` rather than `active`.
- Added regression tests in `server/utils/middleware/validApiKey.test.js` and `server/endpoints/api/apiKeys/index.test.js`.
- Commits: `bd62229e4a4c1ad9222cc6ead45427a744f8cd61` (authentication), `3a69cb4d1a4a5053d485642ebd077a503794a4c7` (middleware test), `e86fc35a728b7a28313922a695807f5a1e921034` (safe metadata), `05da24af16857f79f4f27e099a4032114d604a73` (endpoint test).
- Static source review only; tests, lint, build, migrations, and runtime verification remain outstanding.


## Business analytics route — 2026-10-16
- Added `GET /admin/business-analytics` in `server/endpoints/api/analytics/index.js`, registered through `server/endpoints/admin.js` alongside the session-authenticated admin endpoints.
- The route uses `validatedRequest` and `flexUserRoleValid([ROLES.admin])`, matching the browser session token used by the admin UI and supporting single-user and multi-user modes. It is intentionally not mounted in the developer API-key router.
- Date ranges are validated and capped at 366 days; daily usage trends are aggregated in SQLite with bound query parameters. Revenue/profit remain unavailable until billing and operating-cost sources are integrated.
- Tests and runtime checks remain unexecuted; this is source-level documentation, not proof of successful runtime authorization.


## Usage ledger coverage follow-up — 2026-10-16

- `/v1/openai/chat/completions`, `/v1/openai/images/generations`, and `/v1/openai/embeddings` now have best-effort usage-event capture behind `ENABLE_API_USAGE_METERING=true`.
- Image generation/editing records operation type and observed completion/failure/abort status. Embeddings records model and outcome. Metering errors are swallowed so observability cannot interrupt provider requests.
- Prompts, embedding inputs, image bytes, bearer credentials, and raw provider errors are not written to the ledger. Image and embedding costs/tokens remain unknown; do not infer a zero cost.
- Migration and Prisma Client generation have not been applied/verified; tests, lint, build, and runtime checks remain outstanding. The feature flag must remain disabled until the migration and client are validated in a controlled environment.


## API key lifecycle hardening follow-up — 2026-10-16

- The standard session-authenticated admin and single-user API-key list routes now project safe metadata only; raw secret and secretHash values are not returned by listing endpoints.
- New keys created through those legacy UI endpoints are scoped to the set of workspaces that exist at creation time, rather than inheriting a NULL/unrestricted scope. Newly created keys remain compatible with the one-time secret display flow.
- The standard delete actions now soft-revoke keys through ApiKey.revoke() and emit api_key_revoked audit events instead of hard-deleting records.
- The API-key table now displays status, workspace scope, and expiry metadata; it no longer renders or copies secrets from list responses.
- Added model tests for public key projection, secret/verifier redaction, malformed scope fail-closed behavior, and revoked/expired status.
- These changes are source-level only until the latest GitHub Actions run completes. Database migrations and generated Prisma Client remain pending validation; legacy NULL-scope keys remain unrestricted for compatibility and must be rotated or explicitly remediated.


## Current-state correction — API key lifecycle and workspace inventory (2026-10-16)

The historical findings above describe the state at the time of each inspection. The following controls have since been added on `lebap-ai/development`:

- The current API-key model/schema and migrations include hashed-secret storage, workspace allowlists, expiry, and revocation timestamps. New raw secrets are returned once at creation; public API-key projections omit both the secret and verifier.
- `validApiKey` rejects revoked, expired, and malformed-expiry credentials. Missing/invalid credentials and authentication infrastructure errors fail closed.
- Both admin and single-user key-issuance routes validate `expiresInDays` server-side. Supported lifetimes are 30, 90, and 365 days, or null/no expiry. The UI defaults to 90 days; older clients that omit the field remain compatible and issue non-expiring keys.
- OpenAI-compatible model listing and chat completion enforce explicit workspace allowlists. The vector-store listing now filters workspace records through the same scope policy, so names, slugs, and document counts for disallowed workspaces are not returned to explicitly scoped keys.
- A NULL legacy scope is still intentionally treated as unrestricted for compatibility. Malformed/empty persisted scopes fail closed. Therefore, not every existing credential is tenant-isolated yet; legacy keys must be migrated or rotated before relying on strict tenant boundaries.
- Privileged routes still use an interim active-admin-owned-key policy. This is not a substitute for customer/tenant identity, per-operation scopes, rate/concurrency controls, or hard spend quotas.
- Backend CI previously passed for commit `d1ed57dd2731fdc738b45c840a7a5cff8a6bb248`, and frontend build/lint passed for commit `4459d53e53709473f14ef560435d175e82be8b17`. These commits predate the current expiry-selector and vector-store filtering changes; the newest combined tree must pass fresh CI and runtime/database checks before production sign-off.


## Workspace-scope remediation update — 2026-10-16

- OpenAI-compatible chat completion now rejects requests whose workspace slug is outside the authenticated key's allowlist with HTTP 403.
- Both `GET /v1/openai/models` and `GET /v1/openai/vector_stores` now filter workspace inventories through the same shared fail-closed scope helper. This keeps list endpoints consistent with chat authorization and prevents listing out-of-scope workspaces.
- Unit tests cover allowed, denied, legacy NULL, empty, malformed, and non-array scopes. Backend CI passed on commit `1357e667`; frontend build/lint passed on commit `2bcf2d94`. A new backend run is required for this latest change.
- Remaining gate: scopes are an explicit workspace allowlist, not a complete customer/tenant identity system. Existing legacy keys with a NULL scope remain unrestricted for backward compatibility; rotate and assign scopes before using keys for external tenant isolation.


## Follow-up remediation — workspace allowlist enforcement on API routes

- Added `apiKeyWorkspaceScope` middleware for workspace, workspace-thread, and document route families.
- Workspace-specific routes now reject a slug outside the key allowlist. `GET /v1/workspaces` filters its response to allowed slugs; scoped keys cannot create new unscoped workspaces.
- Document upload routes require every requested `addToWorkspaces` target to be in scope. Scoped keys are denied document operations that do not identify an allowed workspace; static file-type/metadata-schema endpoints remain available.
- Legacy NULL scopes remain unrestricted for compatibility. Explicit empty/malformed scopes fail closed.
- This is a source change that needs fresh backend/frontend CI and route-level integration verification; do not treat it as production sign-off.
