# Repository Structure and Branch Policy

**Reviewed:** 2026-10-20  
**Canonical working branch:** `lebap-ai/organized`  
**Default branch:** `main`

## Branch policy

- Make new implementation changes only on `lebap-ai/organized`.
- Keep `main` as the stable/default branch.
- `lebap-ai/development` has been retired after verifying it was an ancestor of `lebap-ai/organized`; it is no longer present in the remote branch list.
- Retain `migration/anythingllm-upstream` as an upstream-history reference until migration completeness, licensing notices, and recovery needs are verified.
- Preserve upstream-derived code and required license/third-party notices. Do not rewrite history.
- Do not claim production readiness based on source inspection or CI alone.

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

- Current remote branches: `main`, `lebap-ai/organized`, and `migration/anythingllm-upstream`.
- `lebap-ai/organized` is 27 commits ahead of `main` and 0 commits behind it. The current comparison contains documentation and CI configuration changes.
- The deleted `lebap-ai/development` branch was an ancestor of `lebap-ai/organized`; it had no unique commits absent from the canonical working branch.
- Backend test workflow [39462989790](https://github.com/LebapAI/Lebap-AI/actions/runs/39462989790) completed successfully on source commit `911d3940d8cd58717b7c1070294ffbbd1a258026`.
- Frontend build/lint workflow [39462992668](https://github.com/LebapAI/Lebap-AI/actions/runs/39462992668) completed successfully on source commit `5751c7258989a6f077b5db106be65a97eacb45ff`.
- Those successful runs are not on the current branch head; the subsequent commits changed documentation and CI configuration only. Re-run CI on the current head after future application-code changes and before release.
