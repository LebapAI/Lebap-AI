# Lebap AI — Current Engineering Status

**As of:** 2026-10-20  
**Canonical working branch:** `lebap-ai/organized`  
**Release status:** Not production-ready. Source inspection and successful CI runs do not establish production readiness.

## Consolidation decision

- `lebap-ai/organized` is the sole active implementation branch.
- `lebap-ai/development` has been deleted after confirming its commit history was fully incorporated into `lebap-ai/organized`; it had no unique commits missing from the canonical branch.
- `main` remains the stable/default branch; do not use it for ongoing implementation.
- `migration/anythingllm-upstream` remains as an upstream-history reference until its retention, provenance, licensing, and recovery role are explicitly verified.
- Current remote branches are `main`, `lebap-ai/organized`, and `migration/anythingllm-upstream`.
- Do not delete additional branches until unique commits, files, tags, open PR references, and recovery requirements are checked.

## What exists in source

- AnythingLLM-based workspace application with model providers, documents, vector stores, and agent-related features.
- API-key lifecycle controls for newly issued hashed secrets, soft revocation, expiry, public-safe metadata, workspace allowlists, and last-used tracking.
- OpenAI-compatible endpoints for chat completions, image generation/editing, embeddings, model listing, and vector-store listing.
- Shared API-key rate-limit windows and request throttling; distributed correctness, operational behavior, and abuse/load characteristics remain unverified.
- Feature-flagged, best-effort usage-event capture for selected model operations.
- Initial admin business-analytics endpoint and page.
- Initial Lebap AI branding and API/security architecture documentation.

These are source-level observations, not proof that every path is secure or production-ready.

## Verification status

- **Backend CI:** [workflow 39462989790](https://github.com/LebapAI/Lebap-AI/actions/runs/39462989790) completed successfully on source commit `911d3940d8cd58717b7c1070294ffbbd1a258026`.
- **Frontend build/lint:** [workflow 39462992668](https://github.com/LebapAI/Lebap-AI/actions/runs/39462992668) completed successfully on source commit `5751c7258989a6f077b5db106be65a97eacb45ff`.
- These runs passed, but are not on the current branch head. The commits after those tested SHAs changed documentation and CI configuration only; application code was not changed. Re-run the relevant CI on the current head when application code changes and before release.
- **Database:** API-key lifecycle, scope, usage-event, last-used, and rate-limit migrations exist in source. Validate Prisma Client generation and apply migrations only through a controlled procedure against a disposable database first.
- **Runtime:** no live deployment smoke test was performed in this review.
- **Consolidation review:** branch ancestry, current branch list, open PR list, CI results, and key documentation were inspected; this was not a full code audit or production-readiness certification.

## Open security and release gates

1. Complete a route-by-route authorization inventory, including middleware order and indirect access paths.
2. Inventory legacy API keys with NULL workspace scopes and legacy plaintext secrets; plan rotation/migration without silently widening access.
3. Validate rate-limit atomicity and multi-instance behavior; test concurrency, failure modes, and bypass attempts.
4. Add pre-provider quota, budget, and spend enforcement before claiming hard limits.
5. Separate provider-reported usage, estimates, actual provider invoices, and customer charges.
6. Validate tenant/workspace isolation for every supported route and data-access path.
7. Run Prisma validation/generation, migrations on a disposable database, focused tests, full backend tests, frontend build/lint, dependency and secret scans, and runtime smoke tests.
8. Review deployment secrets, backup/restore, monitoring, rate-limit storage, and licensing before release.

## Source of truth

Use `docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md` as the single capability-by-capability status board. Historical implementation notes belong in `docs/archive/`; they must not override current status or be read as proof that a feature is complete.

## Engineering rule

Make focused, test-backed changes only on `lebap-ai/organized`. Keep `main` stable and preserve upstream history. Do not claim tests passed unless their results and tested source SHAs have been inspected.
