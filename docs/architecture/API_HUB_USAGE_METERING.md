# API Hub Usage Metering Design

Status: partially implemented foundation; enforcement and production rollout remain incomplete  
Date: 2026-10-16  
Branch: `lebap-ai/development`

## Goals

Provide a durable foundation for per-client usage analytics, enforceable quotas, cost controls, and auditability without breaking the existing AnythingLLM workspace and API-key flows.

## Constraints observed in the current source

- `api_keys` contains `id`, `name`, nullable unique legacy `secret`, nullable unique `secretHash` for newly issued keys, nullable `createdBy`, nullable `expiresAt`/`revokedAt`, and timestamps. Existing raw-secret records are retained during the compatibility rollout.
- The active Prisma datasource is SQLite. PostgreSQL configuration is commented out. A production database migration must be an explicit infrastructure decision, not an assumed configuration.
- OpenAI-compatible chat, embedding, image generation, and vector-store routes use existing workspace/provider code. Their behavior should remain compatible while a shared metering layer is introduced.
- The API-key record has nullable expiry/revocation timestamps and an optional `workspaceSlugs` allowlist. After migration, allowlists are enforced on OpenAI-compatible model listing/chat only. Operation scopes, tenant ID, rate limits, and spend limits remain absent.

## Recommended data model

### ApiClient / Tenant

A first-class client/tenant record should identify an integration independently of an individual secret. Suggested attributes:
- stable ID;
- display name and status;
- created/updated timestamps;
- optional owner reference;
- configured request-rate, concurrency, and spend limits;
- metadata restricted to non-secret operational labels.

Do not assume `createdBy` is a tenant boundary. It is a user reference and is currently optional.

### API credential

Extend or replace the current API-key model only through a reviewed migration. Suggested fields (in addition to the implemented nullable expiry/revocation timestamps):
- stable credential ID;
- tenant/client ID;
- name;
- secret verifier/hash rather than storing a reusable raw secret, if the existing key issuance and compatibility requirements can be safely migrated;
- status (active/revoked);
- expiry timestamp;
- scopes and optional workspace allowlist;
- created/last-used/revoked timestamps.

Because current credentials may be stored as raw secrets, changing storage to hashes requires a staged compatibility strategy, secure one-time key reissue, and tests. Do not simply change the lookup field and invalidate existing keys unexpectedly.

### Usage event

Use an append-oriented record with fields such as:
- ID and unique request/correlation ID;
- tenant ID and credential ID;
- route/operation and outcome;
- provider and model identifiers;
- workspace ID or stable workspace slug where applicable;
- started/finished timestamps and latency;
- input/output token counts when provider-reported, plus a clear source/quality marker;
- image count or embedding item count for non-chat operations;
- estimated provider cost and currency, cost-estimation version, and whether cost is estimated or provider-reported;
- error category (not raw exception text);
- created timestamp.

Never persist API secrets, authorization headers, raw payment details, or unredacted prompts as routine metering fields. Prompt/content retention should be a separate explicit product and privacy decision.

### Quota and budget policy

Separate configured policy from usage events. Suggested policy dimensions:
- requests per minute and per day;
- concurrent requests;
- token or operation quotas;
- soft budget warning threshold;
- hard budget limit;
- action when exceeded (reject, or require an explicitly configured override).

A quota must be checked server-side before invoking a paid provider. Usage updates must be concurrency-safe; a UI-only warning is not an enforcement control. Streaming requests need an initial authorization/reservation and a final reconciliation step, including disconnect and provider-error cases.

## Request lifecycle

1. Authenticate credential; reject unknown, revoked, expired, or disabled credentials.
2. Resolve tenant/client identity and route scope.
3. Authorize workspace/model/operation against the tenant policy.
4. Apply rate and concurrency controls.
5. Check/reserve quota or budget before provider invocation.
6. Generate a request ID and record a minimal start event.
7. Invoke provider; collect provider-reported usage when available.
8. Finalize usage with latency, outcome, and cost provenance; reconcile reserved budget.
9. Return a stable public response. Log diagnostic details server-side without secrets or raw user content.

If the metering store fails, the policy must be explicit. For routes that can incur billable provider costs, the safe default is to reject new calls when hard quota enforcement cannot be verified, rather than silently bypassing controls.

## Migration and rollout plan

1. Confirm parent router authentication and identify all API route groups.
2. Define tenant identity and ownership rules before adding foreign keys.
3. Add schema and migration for tenant/client, credential metadata, usage events, and quota policies; validate against the active SQLite setup first.
4. Add model-level tests and migration checks, including existing databases with existing API keys.
5. Introduce request context and metering hooks behind a feature flag, initially in observe-only mode.
6. Compare usage records with provider-reported billing/usage and resolve discrepancies.
7. Enable hard rate/spend enforcement only after concurrency, streaming, error, and recovery tests pass.
8. Add admin controls, retention policy, export/audit logs, and operational alerts.

## Acceptance criteria

- A credential cannot enumerate or access another tenant's workspaces.
- Revoked and expired credentials fail closed.
- Rate, concurrency, and hard budget limits are enforced server-side, including simultaneous requests.
- Chat, streaming, embeddings, and image operations produce consistent usage records or an explicit documented reason why a provider cannot supply a metric.
- Provider errors and client disconnects finalize reservations and usage state safely.
- Public responses do not expose raw exceptions, secrets, or internal stack traces.
- Existing AnythingLLM routes and locally configured usage remain compatible.
- Automated tests and migration checks run successfully in CI before rollout.

## Not yet implemented or verified

This document is a design specification only. No database schema migration, metering model, quota middleware, or admin UI is added by this document. Runtime behavior, provider billing fields, parent-router protections, and production database selection remain to be verified.


## Implementation update — 2026-10-16

The source now includes nullable API-key `expiresAt` and `revokedAt` fields, an SQLite migration, optional expiry validation at creation, authentication rejection of expired/revoked credentials, and soft revocation. The migration, Prisma client generation, tests, and runtime behavior have not been verified. All tenant/client scoping, workspace allowlists, hashed-secret migration, usage events, quotas, and rate/concurrency enforcement described above remain design work.


## API credential storage update — 2026-10-16

New credentials are now designed to store a one-way SHA-256 verifier in `secretHash`; the raw secret is returned once at creation. Authentication retains a legacy raw-secret fallback so existing credentials do not immediately break. This is an intermediate rollout state: rotate/reissue legacy keys before removing the raw `secret` field or its compatibility lookup. The new migration and generated Prisma client have not been applied/verified, and tenant/workspace scopes, usage events, quotas, and rate/concurrency enforcement remain unimplemented.


## Workspace allowlist implementation update — 2026-10-16

An optional workspace allowlist is stored in `api_keys.workspaceSlugs`. Key creation requires and validates a non-empty allowlist against existing workspaces, and OpenAI-compatible model listing/chat completion enforce the allowlist. A NULL allowlist intentionally retains existing behavior; this is not complete tenant isolation because other route families and image generation still need explicit authorization. The SQLite migration, generated Prisma client, tests, lint, build, and runtime checks remain outstanding.


## Usage ledger foundation committed — 2026-10-16

Started the first implementation layer for durable API usage accounting:
- Added `api_usage_events` to `server/prisma/schema.prisma` and an SQLite migration with a unique request ID and indexes for key/time/status queries.
- Added `server/models/apiUsage.js` with a minimal start event and conditional, one-time finalization. The model whitelists persisted fields and intentionally does not accept prompts or credential values.
- Added unit tests for required fields, secret/prompt exclusion, non-negative usage values, explicit cost provenance, and duplicate-finalization behavior.
- Commits: `b97c285433c2b369bc16d94030b4e2412cf25137` (schema), `142feab9145b4169143a70bb0cbd4bc75d8a1aaa` (migration), `3b8575589524e03fab9e4645bd17182f7b281ab1` (model), `6ed0216580f2cdbba783f649f405958c537e406d` (tests).
- This is a storage foundation only: no API routes are wired to it yet, so usage is not being collected and no quotas/rate/spend limits are enforced. Migration and Prisma Client generation remain unapplied; tests/build/lint are unexecuted.


## Feature-flagged chat metering hook — 2026-10-16

The OpenAI-compatible chat-completions handler now has an observe-only usage hook controlled by `ENABLE_API_USAGE_METERING=true`:
- It attempts to write a minimal started event after request validation and workspace authorization, using a server-generated ledger ID independent of the caller's `X-Request-Id`.
- Non-streaming success records latency and token counts only when the returned metrics expose recognized non-negative integer fields. Cost remains unknown unless a later integration supplies explicit, validated cost data.
- Streaming success records latency and completion status; token counts are currently unavailable from the route-level integration. Exceptions finalize as failed/aborted without storing prompts or raw provider errors.
- Ledger creation/finalization errors are logged generically and do not block chat responses. This is deliberately observe-only, not quota enforcement.
- The flag defaults off. Enable only after applying the SQLite migration and regenerating Prisma Client. Do not enable in production before that migration is applied.

Remaining: wire usage capture for embeddings and image generation; test streaming/disconnect lifecycle and runtime behavior; apply and verify the migration; validate provider usage field names and pricing provenance; implement concurrency-safe limits only after usage collection is trustworthy. No tests, lint, build, migration, or runtime checks have been run for this change.


### Disconnect classification follow-up — 2026-10-16

The chat handler now observes response closure before the response has finished and uses that signal to finalize an in-flight metering event as `aborted`; ordinary exceptions are classified as `failed`. This is best-effort classification and still requires runtime tests against actual client disconnects and provider stream failures. Commit: `fd8080ffa4979ae5995a6e1f5888a0cd0255b85e`.
