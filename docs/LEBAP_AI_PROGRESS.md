# Lebap AI — Development Progress

Last updated: 2026-10-16

## Active branch
- Repository: `coinsells/Lebap-AI`
- Development branch: `lebap-ai/development`
- Baseline branch: `migration/anythingllm-upstream` (preserve unchanged)
- Do not merge into or overwrite `main` without an explicit review and authorization.

## Confirmed project state
- Upstream AnythingLLM source/history is preserved in `migration/anythingllm-upstream`.
- Development work is on `lebap-ai/development`.
- Roadmap: `docs/LEBAP_AI_IMPLEMENTATION_PLAN.md`.
- API Hub architecture: `docs/architecture/API_HUB.md`.
- Progress tracking: this file.
- Middleware requires an explicit `Authorization: Bearer <key>` header.

## Tests added
- `server/utils/middleware/validApiKey.test.js` was added in commit `62d90bce091850554e0bbf835449bb0133693576`.
- It covers missing/malformed authorization headers, valid and unknown keys, case-insensitive Bearer scheme, and settings-read failure.
- Root `package.json` defines `test: jest`; Jest's default test discovery includes files named `*.test.js`. No Jest config was found at repository root in the inspected paths.
- **Tests have not been executed in this environment. Do not report them as passing.**

## Security caveat requiring follow-up
- `server/models/apiKeys.js` currently catches database lookup exceptions in `ApiKey.get()` and returns `null`.
- The middleware therefore cannot distinguish an invalid key from a failed API-key database lookup; both can become HTTP 403.
- Added `docs/security/API_SECURITY_REVIEW.md` in commit `0a8327bba4d3aef68390c683085f389ebbfeed22`, documenting the confirmed authentication, API-key schema, and SQLite/PostgreSQL configuration findings.
- A proposed compatibility-preserving fix is to add a separate strict lookup method for authentication that allows database errors to propagate, use that method only in `validApiKey`, and add a test for database lookup failure. The existing `get()` behavior should remain unchanged for other callers.
- An attempt to commit this code change was blocked by the GitHub write tool; no change to `server/models/apiKeys.js` was made.

## Latest verified inspection
- Branch list includes `lebap-ai/development`, `main`, and `migration/anythingllm-upstream`.
- Read current versions of `server/utils/middleware/validApiKey.js`, `server/utils/middleware/validApiKey.test.js`, `server/models/apiKeys.js`, root `package.json`, `server/package.json`, and `server/eslint.config.mjs`.
- No local build, Jest run, or lint run was performed; this session had GitHub file access but no configured checkout execution path.

## Exact next actions
1. Apply the strict authentication lookup fix in `server/models/apiKeys.js` and `validApiKey.js`, preserving the existing `ApiKey.get()` contract for all other call sites.
2. Extend middleware tests to cover a rejected strict database lookup and ensure the middleware returns HTTP 500 without exposing the exception or credential.
3. Check formatting against the server ESLint/Prettier configuration.
4. Run focused tests and lint from a real checkout when an execution environment is available; record exact command output.
5. Only after this authentication work is verified, review API routes and Prisma schema for request usage tracking and quotas. Do not add schema migrations before that review.

## Release status
In development. Authentication tests exist but are unexecuted; the strict database-error path is not yet implemented. No production-readiness claim is made.
