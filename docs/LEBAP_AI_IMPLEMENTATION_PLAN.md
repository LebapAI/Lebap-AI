# Lebap AI — implementation roadmap

## Status and repository rules

- Upstream baseline content has been incorporated into the integrated working history. Keep a backup ref until migration completeness and build/test checks are confirmed; do not delete source branches before that gate.
- Active implementation branch: `lebap-ai/organized` (created from the integrated `lebap-ai/development` head on 2026-10-17).
- Work only on `lebap-ai/organized`; avoid parallel implementation branches and duplicate implementations.
- Preserve upstream license and third-party notices. Audit submodules and dependency licenses before redistribution.
- Do not describe the platform as production-ready until builds, tests, security review, and deployment verification pass.

## Product target

Lebap AI is an AI platform/API hub for applications and agents. AnythingLLM is the application foundation, not a complete metering/billing/API-hub product.

## Delivery sequence

### Phase 0 — Baseline and safety
- Keep the upstream migration reproducible and untouched.
- Map existing auth, API keys, model routing, provider adapters, database models, and agent/MCP permissions.
- Add CI for lint/tests and record reproducible local setup instructions.
- Fix narrowly scoped security defects without changing existing API contracts unnecessarily.

### Phase 1 — API platform core
- Define client/tenant identity and ownership boundaries.
- Add scoped, revocable API credentials; store only credential hashes where compatible with a safe migration.
- Add request IDs, structured audit events, per-client rate limits, and usage records.
- Add stable versioned API contracts and generated OpenAPI documentation.
- Preserve the existing AnythingLLM API while introducing new hub routes separately.

### Phase 2 — Usage and spend controls
- Record provider, model, request status, latency, token/usage metadata when available, and tenant/client attribution.
- Implement quotas and hard spend caps before provider execution.
- Make retries bounded and idempotency explicit where supported.
- Separate estimates from provider-reported usage and actual billed costs.

### Phase 3 — Routing and integrations
- Build a provider adapter interface and normalize errors/usage.
- Route based on configured capabilities, availability, latency, and price.
- Add bounded fallback and circuit-breaker behavior.
- Never claim a provider/model is available until credentials and a live integration test confirm it.

### Phase 4 — Agent runtime and tools
- Add per-tenant tool permissions, allowlists, execution timeouts, and resource limits.
- Require explicit approval for high-impact actions.
- Treat external content and tool outputs as untrusted input.
- Log tool invocation metadata without leaking secrets or private prompt content.

### Phase 5 — Administration and operations
- Build a coherent admin UI for tenants, credentials, providers, limits, usage, audit events, and health.
- Add health/readiness endpoints, metrics, alerting, backups, and restore drills.
- Add deployment-specific configuration validation and secret management.

### Phase 6 — Release gates
- Automated lint, unit/integration tests, dependency and secret scans.
- Authorization/tenant-isolation tests and API abuse tests.
- Load and failure-mode tests for rate limits, provider timeouts, and spend controls.
- Restore test and deployment smoke test.
- Legal/licensing review before public/commercial redistribution.

## Current verified work

- The source contains existing API-key validation middleware and OpenAI-compatible endpoints.
- API-key middleware was hardened on this branch to require a two-part Bearer Authorization header and to fail closed if its authentication flow throws.
- This change has been committed, but automated tests/builds have not yet been run in this environment.
