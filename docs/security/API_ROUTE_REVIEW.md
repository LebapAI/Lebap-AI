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

- The API-key model stores `createdBy` and `name`; `getForAuthentication()` retrieves the matching key record. The current `validApiKey` middleware validates the bearer secret but does not put the authenticated key identity into request context.
- The inspected admin routes manage users and workspace membership, but the inspected OpenAI-compatible routes do not visibly intersect the authenticated key with workspace permissions. The key model also has no visible scope, expiry, or revocation-state fields in the inspected model.
- This does **not** establish whether parent middleware or other runtime controls add protection; those paths remain to be inspected. It does establish that tenant authorization is not visible in the reviewed endpoint implementation.
- Do not add an ownership restriction based only on `createdBy` until legacy-key behavior, key-creation semantics, and admin/service-key expectations are confirmed. A rushed filter could break existing installations or grant misleading partial isolation.
- Next implementation gate: trace where API keys are created/deleted and how workspace permissions are enforced; then add explicit credential scope/tenant authorization plus regression tests before enabling third-party tenants.

## Remediation status — Simple SSO token issuance

The route `GET /v1/users/:id/issue-auth-token` was updated to require a key whose `createdBy` user is an active administrator. The API-key middleware attaches only non-secret metadata (`id`, `createdBy`, `name`) to `response.locals.apiKey`. This is a targeted fix, not a global authorization solution. Verify API-key lifecycle compatibility and run automated tests before production use. Commits `230bd6340cd7e208bfa2b5d5509741d9f51ed3f3` and `4eedcbe09b1e5c60750a28df0d6b15497d3ddade`.


## Follow-up — parent router and API key schema confirmed

- `server/index.js` mounts `apiRouter` at `/api` without a global API-key or role middleware. `developerEndpoints(app, apiRouter)` registers API groups on the router; therefore route-level middleware is the relevant control unless another route-specific layer is present.
- The Prisma `api_keys` model contains `id`, `name`, `secret`, nullable `createdBy`, and timestamps only. There are no first-class scopes, expiry, or revocation-state fields in this schema.
- Workspace membership data is stored in `workspace_users`, but the reviewed API-key OpenAI-compatible routes do not visibly bind the key to those memberships.
- This strengthens the static finding that the current API is not yet demonstrably tenant-isolated. It does not establish external exploitability or rule out infrastructure-level network restrictions.
- Do not describe this branch as production-ready for untrusted multi-tenant API customers until credential semantics, authorization, quotas, and regression tests are implemented and verified.


## Remediation — privileged API key owner checks (2026-10-16)

- Added `server/utils/middleware/apiKeyOwnerIsAdmin.js`. After bearer authentication, it requires `response.locals.apiKey.createdBy` to resolve to an active user with role `admin`; missing owners and non-admin/suspended owners receive HTTP 403. Lookup errors fail closed with a generic HTTP 500 response and are not logged with credential data.
- Applied the middleware to every route declared in `server/endpoints/api/admin/index.js` (13 route declarations) and to `GET /v1/users`. The Simple SSO token issuance route retains its equivalent targeted owner/admin check.
- Compatibility impact is intentional: legacy keys with no owner and keys owned by non-admins cannot call these privileged routes. Use an API key created by an active administrator.
- Static source verification confirms the admin module has no remaining route middleware declaration consisting only of `[validApiKey]`. This is not a runtime test.
- Still unresolved: workspace-level authorization for ordinary API keys, API-key scopes/expiry/revocation, per-key rate/concurrency/spend quotas, and normalized usage accounting. Do not enable untrusted multi-tenant customers until these are implemented and tested.
