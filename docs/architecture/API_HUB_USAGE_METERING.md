# API Hub Usage Metering Design

Status: proposed design; not yet implemented in application code  
Date: 2026-10-16  
Branch: `lebap-ai/development`

## Goals

Provide a durable foundation for per-client usage analytics, enforceable quotas, cost controls, and auditability without breaking the existing AnythingLLM workspace and API-key flows.

## Constraints observed in the current source

- `api_keys` currently contains `id`, `name`, nullable unique `secret`, nullable `createdBy`, nullable `expiresAt`/`revokedAt`, and timestamps.
- The active Prisma datasource is SQLite. PostgreSQL configuration is commented out. A production database migration must be an explicit infrastructure decision, not an assumed configuration.
- OpenAI-compatible chat, embedding, image generation, and vector-store routes use existing workspace/provider code. Their behavior should remain compatible while a shared metering layer is introduced.
- The API-key record now has nullable expiry and revocation timestamps, enforced by API-key authentication after the migration is applied. It still has no scopes, tenant ID, workspace allowlist, rate-limit, or spend-limit fields.

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
