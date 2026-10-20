# Lebap AI — Current Engineering Status

**As of:** 2026-10-20  
**Canonical working branch:** `lebap-ai/organized`  
**Release status:** Not production-ready. Source inspection and historical CI results do not establish production readiness.

## Consolidation decision

- `lebap-ai/organized` is the sole active implementation branch.
- `lebap-ai/development` is an older integration branch whose reachable work is incorporated into the organized branch's base.
- `main` remains the stable/default branch; do not use it for ongoing implementation.
- `migration/anythingllm-upstream` is retained as an upstream-history reference until its retention and recovery role is explicitly verified.
- Do not delete any branch solely to reduce the branch count. First verify unique commits, files, tags, open PR references, and recovery requirements.

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

- **Current branch CI:** no combined status checks were returned for the reviewed head; a fresh workflow result is required.
- **Backend tests:** historical successful runs do not validate later commits.
- **Frontend build/lint:** current-head verification is required.
- **Database:** API-key lifecycle, scope, usage-event, last-used, and rate-limit migrations exist in source. Validate Prisma Client generation and apply migrations only through a controlled procedure against a disposable database first.
- **Runtime:** no live deployment smoke test was performed in this review.
- **Consolidation review:** branch ancestry and key documentation were inspected; this was not a full code audit and no test suite was executed.

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

Make focused, test-backed changes only on `lebap-ai/organized`. Keep `main` stable and preserve upstream history. Do not claim tests passed unless the exact current head's results have been inspected.
