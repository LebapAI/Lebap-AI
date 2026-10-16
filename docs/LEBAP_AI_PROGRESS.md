# Lebap AI — Development Progress

## Current focus — API key ownership and tenant isolation

- Re-checked current source on `lebap-ai/development` before continuing.
- Confirmed the API-key model stores `createdBy` and `name`, while `validApiKey` checks the bearer secret but does not attach safe key identity to the request context.
- The OpenAI-compatible model listing enumerates all workspaces; the reviewed routes do not visibly bind requested workspace slugs to the authenticated key's owner or allowed workspace list.
- This remains an audit finding, not a claim that no other middleware exists. Parent-router controls and key creation/deletion flows still need inspection.
- Avoided applying a speculative ownership filter: key creation semantics, legacy keys, and intended admin/service-key access must be established first to prevent breaking existing users or creating false tenant isolation.
- Security review details are recorded in `docs/security/API_ROUTE_REVIEW.md`.
- Tests, lint, build, and runtime verification have not been run in this session.

## Previously completed static hardening

- Production `GET /v1/system/env-dump` no longer invokes `dumpENV()` and returns HTTP 404 in production (commit `9b86a9aa464f7d6da2bdf29fe43f1f5e3e5e5525`).
- `POST /v1/system/update-env` redacts likely secret values in its response (commit `f65397f106221dba22104184892d9d7111bda464`).
- `GET /v1/system` and the update response use a shared response sanitizer for sensitive-looking setting names (commit `448567fb7466fa18efad4efa5111f51d484d8195`).
- These changes have been source-verified after commit; runtime tests have not been executed.

## Latest follow-up — privileged API routes

- Inspected the current `server/endpoints/api/userManagement/index.js` and `server/utils/middleware/simpleSSOEnabled.js` on `lebap-ai/development`.
- `GET /v1/users/:id/issue-auth-token` is guarded by `validApiKey` and `simpleSSOEnabled`. The second middleware checks whether Simple SSO and multi-user mode are enabled, but does not establish that the API key belongs to an authorized administrator. The handler then issues a temporary login token for the user ID supplied in the URL.
- Admin route handlers reviewed use `validApiKey` plus multi-user-mode checks, but no administrator identity/role check is visible in those handlers. This is a high-priority authorization concern requiring confirmation against the full parent-router and deployment access model.
- No runtime exploit was attempted. No source behavior was changed in this follow-up; the next safe implementation step is to map the API key creation/usage contract and confirm whether these endpoints are intentionally restricted by an upstream network or session layer before enforcing role checks.
- This is a source-level finding, not a confirmed externally exploitable vulnerability; tests and deployment configuration have not been inspected sufficiently to make that claim.

## Remediation applied — Simple SSO token issuance

- `validApiKey` now exposes only non-secret API-key metadata (`id`, `createdBy`, `name`) through `response.locals.apiKey`. The bearer secret is not copied into request context.
- `GET /v1/users/:id/issue-auth-token` now requires an API key associated with an active user whose role is `admin` before issuing a Simple SSO token. Unowned/legacy keys and keys associated with non-admin or suspended users are denied.
- Commits: `230bd6340cd7e208bfa2b5d5509741d9f51ed3f3` and `4eedcbe09b1e5c60750a28df0d6b15497d3ddade`.
- This is a narrow targeted remediation. It does not yet establish authorization for every administrative API route or solve workspace tenant isolation. Existing deployments relying on unowned API keys for SSO token issuance may need to create an administrator-owned key.
- Tests, lint, build, and runtime verification have not been run; do not treat this as production sign-off.


## Router mounting verification — 2026-10-16

- Inspected `server/index.js` on `lebap-ai/development`: `/api` mounts an Express router, and `developerEndpoints(app, apiRouter)` registers the developer API groups on that router. The mount itself does not add `validApiKey` or session-role middleware globally.
- Therefore, authentication and authorization must be enforced by individual route middleware. The reviewed developer API route declarations generally include `validApiKey`, but several administrative handlers visibly rely only on API-key validity and multi-user-mode being enabled; this does not prove the caller is an administrator.
- The current API key schema has only `id`, `name`, `secret`, `createdBy`, and timestamps; it has no scopes, expiry, or revocation-state field. Workspace memberships exist for user sessions, but the inspected API-key chat/model routes do not use those memberships to restrict a key to a workspace.
- No broad authorization rewrite was made because current API keys may be shared application-level credentials and a rushed change could lock out existing deployments. The next safe code change requires defining service-key vs user-key semantics and adding regression tests for admin authorization and workspace isolation.
- Status remains **not production signed off**: static inspection only; no tests, lint, build, runtime, or deployment verification has been run here.


## Privileged API authorization hardening — 2026-10-16

- Added `server/utils/middleware/apiKeyOwnerIsAdmin.js`: it requires the authenticated API key to have a `createdBy` user who still exists, has role `admin`, and is not suspended. Missing owners and authorization lookup failures fail closed; no bearer secret is logged.
- Applied this middleware after `validApiKey` to all routes in `server/endpoints/api/admin/index.js` and to `GET /v1/users`, in addition to the earlier Simple SSO token issuance check.
- Compatibility note: unowned/legacy keys and keys created by non-admin users will receive HTTP 403 on these privileged routes. Create an API key while signed in as an active administrator to use them.
- This narrows the administrative API exposure but does **not** implement workspace-scoped credentials, per-client quotas, or normalized usage accounting. API-key and tenant isolation remain incomplete.
- Static code edits only; tests, lint, build, and runtime/deployment verification have not been run in this session.

## Request validation hardening — 2026-10-16

- Updated `server/endpoints/api/openai/index.js` to reject malformed OpenAI-compatible chat requests before workspace lookup: `model` must be a non-empty string and `messages` must be a non-empty array.
- Invalid payloads receive HTTP 400 with a structured `invalid_request_error` response instead of falling through to workspace lookup or causing downstream exceptions.
- Commit: `cac2ca8652f6c7f2ce5c3979377fca9ed9abb2ea`.
- Remaining high-priority issue: API keys are not yet workspace-scoped. The current schema has no key scope/expiry/revocation fields, and broad tenant filtering is unsafe until API-key ownership and legacy-key behavior are defined.
- Verification limitation: source change committed, but tests, lint, build, and live API checks have not been run.

## OpenAI request immutability — 2026-10-16

- Changed the chat-completions handler to read the final user message by index instead of calling `messages.pop()`. This avoids mutating the parsed request payload while preserving the existing “last message must be from user” contract.
- Commit: `2c270f71afe2ef65774f3427798d41fa7c8c91de`.
- A broader validation rewrite was not applied because the update operation was blocked; no claims are made that malformed message objects are fully validated.
- Workspace-level authorization, API-key lifecycle fields, quota/usage tracking, and automated tests remain open. No test/build/runtime verification has been run.



## Product rebrand — 2026-10-16

- Updated the root README's user-facing product branding to Lebap AI and removed the upstream AnythingLLM logo image from the README header.
- Updated root package metadata (name, description, author, repository, issues, homepage) to identify this repository/product as Lebap AI; preserved existing scripts, dependency metadata, and package configuration.
- Updated server package metadata to Lebap AI.
- This is a scoped first pass, not a claim that every occurrence across frontend, desktop, Docker, translations, and internal compatibility identifiers has been changed. Those areas still require a repository-wide inventory and compatibility review.
- No tests, lint, build, or runtime verification were run as part of these documentation/metadata edits.


## Follow-up changes — 2026-10-16

- Updated `frontend/index.html` to remove remaining upstream AnythingLLM social metadata, use Lebap AI repository/image references consistently, improve the product description, and consolidate favicon declarations. Commit: `e2a570b87dc416e14187117c7e33e3d7fb5fa442`.
- Updated `GET /v1/users/:id/issue-auth-token` to use the shared `apiKeyOwnerIsAdmin` middleware rather than duplicating the administrator-owner check inside the handler. This keeps privileged-route authorization consistent and easier to audit. Commit: `527494e82d077a512a4a7087eca410b60f6d341f`.
- Both changes were committed directly to `lebap-ai/development`; no other branch was changed.
- Verification is source-level only. Automated tests, lint, build, and browser/runtime checks have not been run, so these commits are not production sign-off.
- Next priority remains reviewing API key creation/rotation and workspace membership semantics, then implementing workspace authorization without silently breaking existing shared/service keys.


## Sensitive system route hardening — 2026-10-16

- Added `apiKeyOwnerIsAdmin` to the system configuration update, system-wide chat export, and permanent document-removal routes. These operations now require a valid API key owned by an active administrator.
- Commit: `8eb527b34d36d4bc1a2654bbf12703fca2ae253f`.
- Updated `docs/security/API_ROUTE_REVIEW.md` to document the change and compatibility impact (commit `b2c1d910929e95b438f418a2df63c1bae8c4f51a`).
- Compatibility impact is intentional: unowned legacy keys and keys owned by non-admin users are denied on these three sensitive operations. Existing automations using them may need an administrator-owned key.
- This does not complete the full API authorization audit or workspace tenant isolation. Tests, lint, build, and runtime checks have not been run.

## Workspace API authorization hardening — 2026-10-16

- Added the shared `apiKeyOwnerIsAdmin` authorization middleware to the workspace API route group and OpenAI-compatible API route group on `lebap-ai/development`.
- This requires the API key to be associated with an existing, active administrator for workspace CRUD/read routes and OpenAI-compatible model/chat/image operations. Missing-owner and non-admin-owned keys receive HTTP 403; authorization lookup failures fail closed.
- Commits: `5f1a82a22d3d294d5bd1bf218581e81c5c55161f` (workspace routes) and `12b2f43a096baf4f2cfc1bb3335d46201f35699a` (OpenAI-compatible routes).
- Compatibility warning: this is intentionally restrictive and may block existing integrations using legacy/unowned keys or keys owned by non-admin users. Such integrations must use a key created by an active administrator until scoped service credentials are implemented.
- This is **not** tenant isolation: the current API-key schema still has no tenant/workspace allowlist or scopes. Administrator-owned keys can still access all workspaces. The next implementation should introduce explicit service-client/workspace scopes and regression tests before relaxing this guard.
- Verification performed: source edits committed through GitHub. Automated tests, lint, build, migration checks, and live runtime/API verification have **not** been run; this is not production sign-off.

## Sensitive document and embed-history reads — 2026-10-16

- Added `apiKeyOwnerIsAdmin` to three document read/list routes: `GET /v1/documents`, `GET /v1/documents/folder/:folderName`, and `GET /v1/document/:docName`. This reduces exposure of stored document inventory/content to any valid API key.
- Added the same guard to two embed chat-history routes: `GET /v1/embed/:embedUuid/chats` and `GET /v1/embed/:embedUuid/chats/:sessionUuid`, which return potentially sensitive conversation history.
- Commits: `3ce4905889261f76de44ba7aa4290b89acd97efc` (document reads) and `1d9b2696aafc57ae3b36d133d1d6f2b2bef9e2e0` (embed history).
- Compatibility impact: integrations using unowned/legacy API keys or keys owned by non-admin users will receive HTTP 403 on these five routes. This interim guard is intentionally conservative.
- Remaining finding: the API still lacks tenant/client-bound credentials and workspace allowlists. Admin-owned keys remain broad instance-level credentials; this is not tenant isolation. Other document mutations, workspace threads, and embed configuration routes need a full authorization matrix and tests before a client-scoped API can be considered safe.
- Source changes were committed and will be source-verified. Tests, lint, build, migration checks, and runtime/API checks have not been run; no production sign-off is implied.


## Authorization regression tests added — 2026-10-16

- Added `server/utils/middleware/apiKeyOwnerIsAdmin.test.js` with Jest coverage for an active admin key, missing/invalid key ownership, non-admin owner, suspended admin, missing owner record, and an owner-lookup exception.
- Commit: `e215abc9fd61e3d835689fdb241311de2e6379c1`.
- These are authored regression tests, not a passing test result: the connector session cannot execute the repository's Jest suite, so the tests still need to run in CI or a local checkout.
- Important follow-up: inspect the `User.get()` error contract. It currently catches database errors and returns `null`, so some owner lookup failures may be surfaced as 403 rather than the middleware's 500 branch. This is fail-closed, but the distinction should be verified before relying on operational diagnostics.

