# Repository Structure and Branch Policy

**Reviewed:** 2026-10-20  
**Canonical working branch:** `lebap-ai/organized`  
**Default branch:** `main`

## Branch policy

- Make new implementation changes only on `lebap-ai/organized`.
- Keep `main` as the stable/default branch.
- `lebap-ai/development` is an older integration branch and is an ancestor of the current working branch. Retire it only after CI and recovery requirements are reviewed.
- Retain `migration/anythingllm-upstream` as an upstream-history reference until migration completeness, licensing notices, and recovery needs are verified.
- Preserve upstream-derived code and required license/third-party notices. Do not rewrite history.
- Do not claim production readiness based on source inspection or historical CI alone.

## Top-level layout

- `frontend/` — React/Vite user interface, pages, components, styles, and public assets.
- `server/` — API routes, middleware, models, service utilities, and tests.
- `server/prisma/` — Prisma schema and ordered database migrations.
- `collector/` — document ingestion and processing service.
- `docs/` — product plan, implementation matrix, architecture, security review, current status, and archived history.
- `.github/workflows/` — CI definitions for backend tests and frontend build/lint.
- Root package manifests and lockfiles — shared scripts and dependency orchestration.

## Source-of-truth documents

- `README.md` — project purpose, setup, scripts, and top-level limitations.
- `docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md` — capability-by-capability status and acceptance gates.
- `docs/LEBAP_AI_IMPLEMENTATION_PLAN.md` — delivery phases and release gates.
- `docs/LEBAP_AI_PROGRESS.md` — current engineering status and unresolved release risks.
- `docs/architecture/API_HUB_USAGE_METERING.md` — current usage-metering design and limitations.
- `docs/security/API_SECURITY_REVIEW.md` and `docs/security/API_ROUTE_REVIEW.md` — source-level findings and required security work.
- `docs/archive/` — historical notes for context only; current status documents supersede them.

## Branch comparison snapshot

- `lebap-ai/organized` is 23 commits ahead of `main`, with no commits behind it in the current comparison. The current diff against `main` is documentation and CI configuration.
- `lebap-ai/development` is an ancestor of `lebap-ai/organized`; it is not the active implementation target.
- Keep the upstream migration branch until migration/provenance and recovery needs are reviewed.
- Backend tests and frontend build/lint were queued for recent workflow commits on 2026-10-20. Check final results and compare the tested SHA with the current branch head before treating the branch as verified.
