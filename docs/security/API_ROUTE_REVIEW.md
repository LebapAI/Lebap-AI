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
