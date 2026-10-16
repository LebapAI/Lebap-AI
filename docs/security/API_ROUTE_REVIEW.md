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

### 6. Production environment-dump route lacks declared API-key middleware

In `server/endpoints/api/system/index.js`, `GET /v1/system/env-dump` is registered without `validApiKey`. Its handler calls `dumpENV()` when `NODE_ENV === "production"`. The exact contents and access controls of the generated artifact were not inspected here, so exposure impact needs confirmation; nevertheless, a production environment-dump action should not be anonymously invocable.

**Priority: high — remediation committed.** The route now includes `validApiKey` middleware. This enforces API-key authentication, but the existing key model has no administrative scopes; a dedicated admin scope and review of the artifact contents remain follow-up work.


## Follow-up remediation — production env-dump

- The endpoint was previously changed to require a valid API key, but any valid key could still trigger a write of selected process environment values—including credentials—to the server-side `.env` file.
- Commit `9b86a9aa464f7d6da2bdf29fe43f1f5e3e5e5525` removes the direct `dumpENV()` call from `GET /v1/system/env-dump` and returns HTTP 404 for this endpoint in production. The non-production behavior remains a no-op success for compatibility.
- Production environment persistence through the existing `updateENV()` path is unchanged; this change disables only the separate endpoint.
- Static change only; runtime behavior and tests have not been executed in this session.


### 2. System update endpoint response redaction

- Static inspection found `POST /v1/system/update-env` returned `newValues` directly from `updateENV()`, which includes the submitted raw values. Secret values could therefore be reflected to API clients.
- Commit `f65397f106221dba22104184892d9d7111bda464` sanitizes the response at the API boundary: keys whose names indicate keys, tokens, secrets, passwords, connection strings, or auth tokens return only a boolean indicating whether a value is set. Non-sensitive settings retain their returned value.
- The underlying setting update behavior is unchanged. Static source verification only; no runtime tests performed.
