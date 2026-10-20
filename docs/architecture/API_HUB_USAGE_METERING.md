# API Hub Usage Metering

**Status:** Partially implemented; observe-only. Not billing, quota enforcement, or production approval.  
**Reviewed:** 2026-10-20  
**Working branch:** `lebap-ai/organized`

## Purpose

Record minimal, auditable API usage metadata without storing prompts, credentials, authorization headers, raw provider errors, or other sensitive request content. Preserve compatibility with the existing AnythingLLM API and workspace flows while the API Hub is hardened.

## Current implementation

- Prisma model `api_usage_events` and SQLite migration exist.
- `server/models/apiUsage.js` creates a minimal start event and conditionally finalizes it once with a terminal status.
- The OpenAI-compatible chat-completions handler has feature-flagged, best-effort usage capture controlled by `ENABLE_API_USAGE_METERING=true`.
- Usage fields include provider/model/workspace identifiers, operation/route, status, token counts where recognized, estimated cost and provenance fields, latency/timestamps, and an error category.
- Chat metering is observe-only: persistence failures are logged generically and do not block provider responses.
- A separate fixed-window request limiter exists for API keys. Default: 120 requests per 60-second window, configurable through `API_KEY_RATE_LIMIT_PER_MINUTE`. It is not a token quota, concurrency cap, daily limit, or spend limit.

## Known limits and risks

- Usage capture is not complete or proven for every supported provider and operation. Streaming usage may not expose token counts.
- Provider cost is not automatically verified. Missing or untrusted cost data must remain unknown, not be represented as zero or as a confirmed charge.
- No hard token, operation, daily, concurrency, or spend enforcement is implemented.
- The default Prisma datasource is SQLite. A shared SQLite file must not be assumed to provide safe multi-instance production semantics; database selection is an explicit deployment decision.
- API keys with `workspaceSlugs = NULL` retain legacy unrestricted behavior. This is not tenant isolation.
- Legacy raw-secret API keys remain supported for compatibility while newly issued keys use a one-way SHA-256 verifier. A staged rotation/deprecation plan is required before removing the fallback.
- Migrations, generated Prisma Client, integration behavior, concurrency behavior, and production database operations require controlled validation.

## Data handling rules

1. Never store API secrets, bearer tokens, authorization headers, prompts, completion bodies, raw provider exceptions, or payment credentials in usage events.
2. Store only normalized error categories; keep diagnostics generic and scrubbed.
3. Store token counts only when the provider or integration supplies validated non-negative integer values.
4. Store estimated costs only with explicit provenance, currency, and estimation method/version. Do not conflate estimated provider cost with invoices or customer charges.
5. Keep retention, export, access control, and deletion policy explicit before collecting production usage data.

## Request lifecycle target

1. Authenticate the API credential and reject unknown, expired, revoked, or disabled keys.
2. Resolve owner/client identity and authorize the route, operation, and workspace.
3. Apply request-rate and concurrency controls.
4. Before paid provider invocation, atomically reserve and verify any applicable quota/budget.
5. Create a server-generated request ID and minimal start event.
6. Invoke the provider and collect validated usage when available.
7. Finalize the event once with outcome, latency, usage, and cost provenance; reconcile any reservation.
8. Return a stable public response without secrets, raw exceptions, or internal stack traces.

Hard limits must fail closed if the system cannot verify a quota reservation. The existing observe-only event capture is intentionally not a hard enforcement control.

## Required implementation and release gates

- [ ] Complete a route-by-route authorization inventory and integration tests for allowed and denied access.
- [ ] Define first-class tenant/client identity; do not treat `createdBy` as a tenant boundary.
- [ ] Define operation scopes and a migration/rotation plan for legacy unrestricted keys.
- [ ] Validate Prisma schema/client generation and all migrations against a disposable database.
- [ ] Test rate-limit atomicity, concurrency, shared-database behavior, cleanup, and database outage behavior.
- [ ] Add provider-specific usage tests for chat, streaming/disconnect, embeddings, and image operations.
- [ ] Add concurrency-safe quota/budget reservation and reconciliation before enabling hard limits.
- [ ] Validate provider pricing and provenance; keep billing/customer charging separate from estimates.
- [ ] Run backend tests, frontend build/lint, dependency/secret scans, and deployment smoke tests on the exact release commit.
- [ ] Define retention, access, export, and deletion controls before production usage collection.

## Historical notes

Earlier design and implementation chronology is indexed in [API Hub Usage Metering History](../archive/API_HUB_USAGE_METERING_HISTORY.md). The history must not override this current status.
