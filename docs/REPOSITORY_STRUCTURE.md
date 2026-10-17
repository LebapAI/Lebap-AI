# Repository structure and migration baseline

**Working branch:** `lebap-ai/organized`  
**Baseline commit:** `604a918d66bb4b78c6313dbc3d32d485cfaa52d4` (integrated development head, 2026-10-17)

## Rules

- Make all new implementation changes on `lebap-ai/organized` only.
- Extend existing modules instead of creating a second implementation of the same capability.
- Keep upstream-derived code and its license/third-party notices intact.
- Do not remove a branch until its unique commits and files are verified on this branch and CI/build checks are reviewed.
- Do not claim production readiness from source inspection alone.

## Top-level layout

- `frontend/` — React/Vite user interface, pages, components, styles, public assets.
- `server/` — API routes, middleware, models, service utilities, and tests.
- `server/prisma/` — Prisma schema and ordered database migrations.
- `docs/` — product plan, capability matrix, architecture, security reviews, and progress notes.
- `.github/workflows/` — CI definitions for backend tests and frontend build/lint.
- Root package manifests and lockfiles — shared scripts and dependency orchestration.

## Key documentation

- `LEBAP_AI_IMPLEMENTATION_MATRIX.md` — capability-by-capability implementation status and acceptance gates.
- `LEBAP_AI_IMPLEMENTATION_PLAN.md` — delivery phases and release gates.
- `LEBAP_AI_PROGRESS.md` — dated engineering history; historical entries can be superseded and must not be read as current status without checking their date.
- `architecture/API_HUB.md` and `architecture/API_HUB_USAGE_METERING.md` — API Hub and usage-accounting design.
- `security/API_SECURITY_REVIEW.md` and `security/API_ROUTE_REVIEW.md` — source-level findings and remaining security work.

## Migration audit snapshot

- `lebap-ai/development` contains all commits reachable from `main` and is three commits ahead of `main`.
- `lebap-ai/development` is 367 commits ahead of `migration/anythingllm-upstream`; the upstream migration branch is an ancestor, not a newer source of changes.
- The new working branch was created from `lebap-ai/development` at `604a918d66bb4b78c6313dbc3d32d485cfaa52d4`.
- Before removing old refs, compare each old branch with this branch and preserve a recovery reference until verification is complete.
- Current CI status must be checked against the new branch's head. Historical green runs do not validate later commits.
