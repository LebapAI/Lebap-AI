# Lebap AI — Product implementation matrix

**Active branch:** `lebap-ai/development`  
**Status date:** 2026-10-16  
**Release status:** Not production-ready; CI, build, integration tests, deployment and security gates remain outstanding.

This matrix turns the 15 requested product capabilities into implementation work. A dependency being present, a design document existing, or an inherited upstream feature is not proof that the complete Lebap AI capability is implemented.

## Status definitions

- **Foundation exists:** useful inherited functionality exists; product-level acceptance criteria are not yet met.
- **Partial:** some implementation exists but important controls or workflows are missing.
- **Not verified / not implemented:** repository inspection has not established a working complete implementation. Treat as unfinished until code and tests prove otherwise.

## Capability matrix

| # | Capability | Current evidence/status | Completion gate |
|---:|---|---|---|
| 1 | Multiple model providers | Foundation exists: provider SDKs/adapters and workspace-level provider configuration are present. | Provider registry, capability metadata, credential health checks, normalized errors/usage, and integration tests for each claimed provider. |
| 2 | Create and manage AI agents | Partial: workspace agent-related models and existing agent features are present. | First-class agent definitions, versions, lifecycle/status, configuration validation, execution history, permissions, and CRUD/API/UI tests. |
| 3 | Multi-agent orchestration (Swarm and alternatives) | Not verified as a complete platform capability. | Comparative design; bounded orchestrator; task hand-off; shared state contract; retries/timeouts/cancellation; loop prevention; tracing; deterministic tests. |
| 4 | MCP and external tools | Partial: MCP SDK dependency exists; that alone does not prove complete MCP operations. | Managed MCP connections, tool discovery, allowlists, auth/secret handling, per-agent permissions, timeouts, approval gates, audit events, malicious-output tests. |
| 5 | Unified API Hub | Partial: developer/OpenAI-compatible routes, admin API-key management, a staged usage ledger, feature-flagged chat event capture, and an admin business-analytics endpoint/dashboard now exist in source. Expiry, soft revocation, hashed storage for new credentials, and workspace allowlists have staged SQLite migrations. Legacy raw-secret records and NULL-scope keys remain compatible; migrations, Prisma generation, tests, and runtime verification are pending. Usage capture covers chat completions only and defaults off. | Versioned hub routes, client/tenant identity, stable request IDs/errors, scoped credentials, quotas, usage events, OpenAPI docs and compatibility tests. |
| 6 | Intelligent model routing | Partial: existing provider selection exists. | Policy-driven routing by capability, configured availability, latency and cost; bounded fallback/circuit breakers; no secret leakage; routing tests. |
| 7 | Memory, documents, RAG, knowledge bases | Foundation exists for documents/workspaces/vector stores. | Agent memory lifecycle, source attribution, tenant/workspace permissions, retrieval evaluation, retention/deletion controls and cross-tenant isolation tests. |
| 8 | Workflow automation | Partial: existing background/task capabilities require a full inventory. | Workflow definitions, triggers, durable state, retries, timeout/cancel, approvals, idempotency, execution logs and end-to-end tests. |
| 9 | Agent framework integrations | Not verified as a common adapter layer. | Framework-neutral agent contract and at least two tested adapters; streaming, tool calls, cancellation and error normalization. |
| 10 | Agent/tool catalog | Not verified as a complete catalog. | Search/list/detail, versioning, trust/source metadata, install/enable/disable, permission review and catalog API/UI tests. |
| 11 | Security and extension governance | Partial: admin-key guards cover workspace, thread, document, embed, OpenAI-compatible and privileged admin routes; listing redacts secrets, new keys store a one-way verifier, expiry/soft revocation are enforced in source, and optional workspace allowlists are enforced on OpenAI-compatible model listing/chat. Workspace-scoped keys are denied on other privileged routes; migrations and tests are not run. | Tenant isolation, scoped credentials, extension trust policy, scoped tool grants, credential lifecycle, audit trail, sandbox/resource limits, abuse tests and threat-model review. |
| 12 | Unified platform UI | Partial: inherited web UI exists and product metadata/branding has started. | Consistent navigation, design tokens, accessible responsive layouts, complete agent/API/provider/catalog/admin flows and browser smoke tests. |
| 13 | Mobile support | Not verified to product acceptance criteria. | Tested responsive critical flows on mobile viewport; accessible navigation, forms, tables, chat/agent controls and mobile browser smoke tests. |
| 14 | Admin panel | Partial: inherited administrative features exist. | Central controls for tenants, credentials, providers, routing, quotas, usage/costs, agents/tools, audit, system health and permissions. |
| 15 | Extensible architecture | Partial: server/frontend/collector separation exists; API Hub/usage designs exist. | Stable module contracts, versioned APIs, provider/agent/tool adapters, migrations, compatibility tests and documented extension points. |

## Required delivery order

### Gate A — Secure foundations
1. Inventory all API routes and authentication/authorization paths.
2. Define tenant/client, user-key and service-key semantics without silently breaking legacy credentials.
3. Implement and test workspace/tenant isolation.
4. Expiry, soft revocation, hashed storage for new keys, and optional workspace allowlists have staged SQLite migrations; apply migrations and run tests before relying on them. Extend allowlist enforcement to every relevant route and add operation/client scopes.
5. Add CI checks and repeatable test/build commands.

**Do not expose the platform as a multi-tenant public API until this gate passes.**

### Gate B — API Hub and model routing
1. Add request IDs and stable public error envelopes.
2. Implement provider registry/capability metadata and normalized provider results.
3. Add usage events with provider-reported metrics separated from estimates.
4. Enforce rate/concurrency/quota/spend controls server-side before paid provider calls.
5. Add routing policy and bounded failover.
6. Test streaming, client disconnects, provider errors, concurrency and budget reconciliation.

### Gate C — Agents, MCP and workflows
1. Define the versioned agent and tool contracts.
2. Implement managed MCP connections and explicit tool permissions.
3. Implement bounded multi-agent orchestration after evaluating Swarm and alternatives.
4. Add workflow execution, cancellation, retries, approvals and audit history.
5. Add catalog lifecycle and framework adapters.
6. Test prompt injection, untrusted tool output, loops, resource exhaustion and cross-tenant access.

### Gate D — UI and operations
1. Complete the brand/design system and responsive application shell.
2. Deliver agent, tool, provider, workflow and API Hub screens.
3. Deliver admin/tenant/usage/audit/health screens.
4. Add accessibility, mobile-browser and end-to-end tests.
5. Complete backup/restore, deployment smoke tests, dependency/secret scans and license review.

## Engineering rules

- Work only on `lebap-ai/development`; do not change `main` or `migration/anythingllm-upstream`.
- Preserve existing API compatibility unless a reviewed migration says otherwise.
- Do not add a feature flag or UI control that implies a backend capability is operational when it is not.
- Do not claim tests pass unless they were actually executed and their results inspected.
- Do not mark a gate complete based only on documentation, dependency presence, or static inspection.
- Prefer small cohesive implementation slices with tests; avoid broad schema/auth rewrites without migration and compatibility coverage.

## Current verification limitation

The latest source review confirmed existing provider/workspace/document functionality, the MCP SDK dependency, and several targeted API security changes. It did **not** execute the test suite, lint, build, migrations, runtime API tests, or deployment checks. All capability completion gates above remain open until verified.


## 2026-10-16 incremental delivery note

The API Hub now has an initial administrator-only credential management surface in `server/endpoints/api/apiKeys/index.js`: list metadata, create an administrator-owned key, and revoke a different key. The new test file covers secret handling and core endpoint decisions, but those tests have not been executed. This does not close Gate A: there are still no credential scopes, expiry fields, tenant/workspace binding, rate limits, quotas, or usage accounting, and no runtime verification has been performed.


## Credential lifecycle implementation note — 2026-10-16

The SQLite schema now declares nullable `api_keys.expiresAt` and `api_keys.revokedAt`, with migration `server/prisma/migrations/20261016150000_api_key_lifecycle/migration.sql`. New keys may have an optional future expiry; the authentication middleware rejects expired or revoked keys; the admin delete route now performs a soft revocation and key listings show lifecycle status without secrets.

This remains source-only. The migration has not been applied, Prisma client has not been regenerated, and Jest/lint/build/runtime checks have not been run. Credential scopes, tenant/client identity, workspace allowlists, rate limits and usage metering remain open.


## API credential storage update — 2026-10-16

Newly issued API keys now persist a SHA-256 verifier in `api_keys.secretHash`, not the raw bearer secret. The creation response returns the raw secret once. Authentication supports both hashed new credentials and existing raw-secret records during migration; existing legacy secrets have **not** been automatically transformed or removed. A separate nullable SQLite migration preserves existing rows. Migration application, Prisma generation, tests, lint, build, and runtime verification remain outstanding.


## Workspace allowlist implementation note — 2026-10-16

Optional API-key workspace allowlists are now accepted during key creation and enforced on OpenAI-compatible model listing and chat completion. Existing keys with NULL allowlists preserve prior behavior. This is an incremental control, not complete tenant isolation: other API route families and image generation still require operation/resource scopes, and the SQLite migration, Prisma generation, tests, lint, build, and runtime verification remain outstanding.


## Business analytics implementation note — 2026-10-16

Added `GET /v1/admin/business-analytics` guarded by API-key validation and active administrator ownership, plus the admin-only `/settings/business-analytics` page. The dashboard displays recorded request outcomes, completion rate, token counts, average latency, top models/providers, user/workspace/API-key counts, and coverage-qualified AI cost. It intentionally displays revenue and profit as unavailable until billing and operating-cost sources exist; unknown-cost usage is not treated as free. Date ranges are validated and limited to 366 days. SQLite migration and Prisma Client generation are still pending; tests, lint, frontend build, and runtime checks have not been executed.


## Business analytics trend follow-up — 2026-10-16

The business-analytics endpoint now returns a bounded daily trend using a database-side SQLite aggregation instead of loading every usage event into application memory. The dashboard renders the latest 14 dates with recorded activity. The completion-rate denominator now excludes in-progress events and includes only terminal outcomes (completed, failed, aborted). Tests were updated to cover daily trend output, but have not been executed. Migration, Prisma Client generation, frontend build, and runtime checks remain outstanding.
