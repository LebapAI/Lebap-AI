# Lebap AI — Product implementation matrix

**Active branch:** `main`  
**Status date:** 2026-10-20  
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
| 5 | Unified API Hub | Partial: developer/OpenAI-compatible routes, admin API-key management, a staged usage ledger, feature-flagged chat event capture, and an admin business-analytics endpoint/dashboard now exist in source. Expiry, soft revocation, hashed storage for new credentials, and workspace allowlists have staged SQLite migrations. Legacy raw-secret records and NULL-scope keys remain compatible; migrations, Prisma generation, tests, and runtime verification are pending. Feature-flagged usage capture now covers OpenAI-compatible chat completions, image generation/editing, and embeddings; it defaults off. Daily admin analytics and backend regression tests are present in source. The backend test workflow passed on commit `7477fb17e21ac2ffc5d2ed50adaeefea3e3ba88c`, but later commits require their own CI result. The migration and generated Prisma Client still require controlled validation. | Versioned hub routes, client/tenant identity, stable request IDs/errors, scoped credentials, server-enforced quotas/rate limits, verified cost accounting, OpenAPI docs and compatibility tests across all supported operations. |
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

- Use `main` as the canonical implementation and release-preparation branch. Create short-lived task branches only when useful, then merge them back into `main`.
- Keep `main` as the canonical/default branch and preserve `migration/anythingllm-upstream` as the upstream-history reference until a separate retention review.
- Preserve existing API compatibility unless a reviewed migration says otherwise.
- Do not add a feature flag or UI control that implies a backend capability is operational when it is not.
- Do not claim tests pass unless they were actually executed and their results inspected.
- Do not mark a gate complete based only on documentation, dependency presence, or static inspection.
- Prefer small cohesive implementation slices with tests; avoid broad schema/auth rewrites without migration and compatibility coverage.

## Current verification limitation

The repository consolidation review on 2026-10-20 checked branch relationships and documentation consistency. It did **not** execute the test suite, lint, build, migrations, runtime API tests, or deployment checks. The `main` branch was advanced to the former `lebap-ai/organized` head on 2026-10-20. Fresh CI results for the resulting `main` head still need to be confirmed. All capability completion gates above remain open until verified.

