# Lebap AI — Development Progress

## Current focus — API key ownership and tenant isolation

- Re-checked current source on `lebap-ai/development` before continuing.
- API-key authentication now attaches safe identity metadata and an optional parsed `workspaceSlugs` allowlist. Newly issued credentials store a SHA-256 verifier; expiry and revocation are checked in source.
- OpenAI-compatible model listing and chat completion enforce explicitly configured workspace allowlists. NULL scope remains backward-compatible and unrestricted, so this is not yet complete tenant isolation.
- The remaining authorization gap covers other API route families, operation scopes, client/tenant identity, and image/provider operations. Legacy raw-secret credentials also remain compatible until rotated.
- These are source-level changes only; migration application, Prisma Client generation, automated tests, lint, build, and runtime checks remain outstanding.
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
- Follow-up completed in commits `77e30bcd0a2047b959bccf2592f9c8ea17bb8ff5`, `3cfff3ebf6ca3fc23dc31d5d21dbf3fbc4060413`, and `e43fd146ba0dbd5342824799b20338930d6a3e6d`: added `User.getForAuthorization()`, which propagates database lookup errors, wired the admin-key middleware to it, and updated the regression test mock. This allows infrastructure failures to reach the middleware's generic HTTP 500 path instead of being mistaken for a missing owner (403).


## Authorization lookup error handling — 2026-10-16

- Added `User.getForAuthorization()` as a strict lookup for security decisions. Unlike the general-purpose `User.get()`, it does not swallow database errors.
- Updated `apiKeyOwnerIsAdmin` to use the strict lookup. Missing or unauthorized owners still fail closed with 403; a database/query exception returns a generic 500 without leaking details.
- Updated the regression test to mock the new method.
- Commits: `77e30bcd0a2047b959bccf2592f9c8ea17bb8ff5`, `3cfff3ebf6ca3fc23dc31d5d21dbf3fbc4060413`, `e43fd146ba0dbd5342824799b20338930d6a3e6d`.
- Source changes are verified in GitHub. Tests/lint/build/runtime checks remain unexecuted.

## Product implementation program and API foundation — 2026-10-16

- Added `docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md` to map all 15 requested product capabilities to current evidence, completion gates, and a dependency-ordered delivery plan. It explicitly distinguishes inherited functionality, partial work, and unverified capabilities.
- Added `apiRequestId` middleware and registered it before developer API route groups. A valid short correlation ID is preserved; missing or unsafe IDs are replaced with a server-generated UUID and returned in the `X-Request-Id` response header.
- Added Jest coverage for accepted, missing, and invalid correlation IDs.
- Commits: `6b4563bf6362925acc7a71b2633412cfec5d99c9` (matrix), `c0797b0fdc1b4f85606b59dc4fe8629eae6aee06` (API registration), `e283e71ec74968304d581318983d85948d31a199` (middleware), `7b41e9eb237cee03170b7d583c47d90771e25771` (tests).
- Verification limitation: source files were committed, but the Jest test, lint, build, and runtime behavior have not been executed in this session. This is a first small API Hub foundation, not a completed API Hub.

## API-key authentication regression coverage — 2026-10-16

- Extended `server/utils/middleware/validApiKey.test.js` to assert that successful authentication passes only key ID, owner ID, and name to downstream authorization; the bearer secret and stored secret are not copied into `response.locals`.
- Commit: `ffce0e170aa8b46dc39ae1fb61beb42b75002a99`.
- Existing tests cover malformed/missing Bearer headers, unknown keys, authentication storage failures, and multi-user settings failures. This additional test is authored but **has not been executed**; no claim is made that the suite passes.

## Thread and embed management API guard — 2026-10-16

- Added `apiKeyOwnerIsAdmin` after `validApiKey` to all six workspace-thread API routes (create, rename, delete, read chat history, and other thread operations in that route module).
- Added the same administrator-key guard to all six embed management/list/history routes in the developer API module. This closes the currently visible gap where a valid but non-admin API key could manage workspace threads or enumerate/create/update/delete embed configurations.
- Commits: `5ed71739714d170d4714cb2a1558330375569372` (workspace threads) and `bb80c04a659bca1f37d9803af850d2ca80a95f04` (embed API).
- Compatibility impact: integrations using legacy/unowned keys or keys owned by non-admin users will now receive HTTP 403 on these routes. This is a conservative temporary control, not tenant-scoped authorization; proper client/workspace scopes remain required.
- Verification: fetched both updated files from `lebap-ai/development` and confirmed all 12 route declarations use both middleware functions. Tests, lint, build, and runtime requests have not been run.

## Document mutations, workspace deletion, and image-generation authorization — 2026-10-16

- Added administrator-key authorization to all document API routes in `server/endpoints/api/document/index.js`, including upload, URL/raw-text ingestion, document/folder listing and reads, folder creation/removal, file moves, and generated-file downloads. For multipart uploads, the admin guard runs before the upload handler so unauthorized callers are rejected before file-processing middleware.
- Added administrator-key authorization to workspace deletion before the existing deletion-protection middleware.
- Added administrator-key authorization to OpenAI-compatible image generation before upload/provider work, limiting unauthorised provider-cost exposure while client-scoped quotas are not implemented.
- Commits: `d85c20830eb2d5e1f54a1a467aeec0147aa81bf0` (document routes), `c9f8181ec6314b2de62f1069309abf4c09ec71a8` (workspace deletion), and `0f0f2a9570c8e79aea38f5ea6bf283e0d423fb55` (image generation).
- Compatibility impact is intentionally broad: these API routes now require an active administrator-owned key. This is an interim containment measure, not the final product permission model; external agents need scoped credentials and explicit workspace permissions before non-admin access can safely be enabled.
- Static verification: fetched the updated source files and confirmed the expected middleware ordering. Tests, lint, build, provider calls, and runtime API checks have not been executed.

- Updated `docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md` to reflect the expanded route-level authorization coverage and to keep tenant-scoping, credential lifecycle, metering, quotas, and runtime validation explicitly open. Commit: `43b5b66bdd57f525bade5675403beb13f2d94575`.


## API Hub credential operations — 2026-10-16

- Added `server/endpoints/api/apiKeys/index.js` and registered the route group in `server/endpoints/api/index.js`.
- Added administrator-guarded endpoints:
  - `GET /v1/admin/api-keys`: lists key metadata without returning stored secrets.
  - `POST /v1/admin/api-keys`: validates a 1–100 character name, creates a key owned by the authenticated active administrator, and returns the secret only in the creation response.
  - `DELETE /v1/admin/api-keys/:id`: validates the identifier, checks existence, performs a soft revocation, and prevents the credential used for the request from revoking itself.
- Key creation and revocation emit audit events. Audit-storage failure is handled as best-effort so a completed credential operation does not become an ambiguous failed response.
- Added `server/endpoints/api/apiKeys/index.test.js` covering secret redaction, route guards, list/create validation, self-revocation prevention, revocation audit events, malformed IDs, missing keys, expiry validation, and audit-store failure handling.
- Commits: `79645228f25a07837f4a7e1b748eaf7b7e29aa7f`, `c9590668d83f61b5f3964b534b81d19406734d27`, `9a2cd0c06ee7928761ba4d71652d6469f5b95b3f`, `3846faf828ae9ff420b1918f7286c8bdb291e93c`, `093b60df6b8a45b35bb6d4bd7bb5c97a10b3fb68`, and `6018b1cc4302c45bcffc02f1b86630d4ec4ee8db`.
- Added nullable SQLite migration `server/prisma/migrations/20261016150000_api_key_lifecycle/migration.sql` and schema fields `expiresAt`/`revokedAt`. Newly created keys may receive an optional future ISO-8601 expiry; authentication rejects expired and revoked keys; revocation preserves a record for lifecycle/audit references. Existing keys remain valid after migration because both fields are nullable. Secrets are still stored according to the existing API-key model.
- Verification is source-level only. The test suite, lint, build, migration checks, runtime API tests, and deployment have **not** been run.


## API key lifecycle follow-up — expiry and soft revocation

- Added nullable `expiresAt` and `revokedAt` fields to the Prisma SQLite schema with migration `20261016150000_api_key_lifecycle`.
- API key creation accepts an optional future ISO-8601 `expiresAt`; invalid or past values return HTTP 400. Listing reports active/expired/revoked status without revealing secrets.
- Authentication now rejects revoked and expired credentials. Administrative revocation records `revokedAt` rather than physically deleting the key.
- Added middleware tests for expired/revoked credentials and endpoint tests for expiry validation.
- Commits: `dd8a0b2d38add415271afbcb5c7756629eb0c195` (schema), `c10626733bcb8062989d9f018f52a18b9de0fd6b` (migration), `244f2addf4999e84551b0667b06e1f3352c45aea` (model), `1dfd943a1f7a486614dc8a8c9623c29d6aa27f82` (authentication), `f011f81ee14628c79de7a88f988d7f9c7d00615d` (API), `10d771a6350b82eed98caa768a137d756f83359c`, `e733f86317a8ff935f10c45bc0c5202a49f47440`, `2b288b614615c495ae7160dd397c9cfcadfa8a97`, `de5648b94a2c2c84553d218e917415a1ded06f29`, and `1ed0b1389d597ab7e7b2edc8c26f6540ce0724e5` (validation and tests).
- Not run: Prisma migration application, Prisma client generation, Jest, lint, build, runtime API checks, or deployment. Do not assume the live database has the new columns until the migration is applied.


## API credential storage hardening — 2026-10-16

- New API credentials are now stored as SHA-256 verifiers in `secretHash`; the raw secret is returned only in the one-time creation response and is not written to the database.
- Authentication checks the verifier for newly created keys and retains a compatibility lookup for existing legacy records with raw `secret` values. This is a transition design, not full legacy-secret eradication: old records remain raw until explicitly rotated/reissued.
- Added a nullable unique `secretHash` field to the Prisma schema and a separate SQLite migration, preserving existing rows. The migration has not been applied and Prisma Client has not been regenerated.
- Added model-level tests for hashed storage, one-time secret return, hashed lookup, and legacy lookup.
- Security note: SHA-256 is used as a deterministic verifier because API keys are high-entropy random credentials; never use this scheme for human passwords. A later rotation/migration should remove legacy raw secrets once all existing keys have been reissued.
- Verification remains source-only: Jest, lint, build, migration execution, and runtime API checks have not been run.


## Workspace-scoped API credentials — 2026-10-16

- Added nullable `api_keys.workspaceSlugs` JSON storage and a separate SQLite migration. Existing keys remain unrestricted for backward compatibility; newly created keys may opt into a non-empty allowlist of existing workspace slugs.
- API-key creation validates the allowlist format, rejects duplicates and unknown workspaces, and includes the scope in audit metadata and secret-redacted key listings.
- API-key authentication parses the stored allowlist. Malformed stored scope fails closed as an empty allowlist rather than silently granting access.
- OpenAI-compatible `GET /v1/openai/models` returns only allowlisted workspaces for scoped keys; chat completion checks the requested workspace before running the chat.
- Scope is enforced for OpenAI-compatible model listing and chat completion; the shared administrator guard denies workspace-scoped keys on other privileged routes, including key management and image generation. Existing keys with NULL scope remain unrestricted by design until owners configure and rotate them.
- Added endpoint tests for allowlist validation/storage and unknown workspace rejection; updated middleware metadata expectations. Tests, lint, build, migrations, and runtime checks have not been run.


## Least-privilege default for newly issued credentials — 2026-10-16

- The administrator API-key creation endpoint now requires an explicit non-empty workspace allowlist referencing existing workspaces. Newly issued API credentials cannot accidentally default to unrestricted workspace access through this endpoint.
- Existing keys with NULL allowlists remain compatible and unrestricted until explicitly rotated/configured. This is a compatibility exception, not the recommended setting.
- Workspace-scoped keys are limited to OpenAI-compatible model listing and chat completion; the shared admin guard denies them on other privileged operations. Chat requests are checked against the key's allowlist before provider execution.
- The schema migration and automated tests are committed but remain unexecuted in this environment. Apply migrations and run the full server test/lint/build pipeline before deployment.


## Security follow-up — fail-closed workspace scope parsing (2026-10-16)

- Fixed a scope-parsing edge case in `server/utils/middleware/validApiKey.js`: an empty persisted string is no longer treated like a legacy unrestricted key. Only SQL NULL/undefined retains the compatibility behavior; empty strings, malformed JSON, empty arrays, and malformed entries now fail closed to an empty allowlist.
- Added regression cases in `server/utils/middleware/validApiKey.test.js` for NULL compatibility, malformed scopes, normalization/deduplication, and the empty-scope middleware path.
- Commits: `68bc30f7f7116d85eef4d56122215728c07784be` (middleware) and `4d145ce7d862a92b9e07f1df892f6e720a37f581` (tests).
- These tests have been authored but not executed. Migrations remain unapplied; Prisma Client generation, lint, build, and runtime checks are still outstanding.


## Security follow-up — align API key scope display and enforcement (2026-10-16)

- Updated `publicApiKey()` in `server/endpoints/api/apiKeys/index.js` so empty strings and malformed persisted workspace scopes display as an empty restricted allowlist, matching the authentication middleware. Only SQL NULL/undefined displays as the legacy unrestricted value.
- Added endpoint-level regression tests for empty scope, malformed JSON, non-array JSON, empty arrays, duplicate scope entries, and NULL compatibility.
- Commits: `2d211d1340af05e2cd22ddeb742ece0b83415143` (endpoint) and `a355a5d068339195bcea161a643652fee256954c` (tests).
- Reconciled `docs/security/API_SECURITY_REVIEW.md` with the current implementation and remaining risks, including legacy unrestricted keys, legacy plaintext secrets, incomplete route coverage, missing usage/spend limits, and unexecuted verification (commit `256f26c38f52dd992e0098d716d8a651deab5b36`).
- No tests or build were executed. The code and tests are committed, but remain unverified at runtime.


## Privileged system-route hardening — 2026-10-16

- Route inventory found three system-information endpoints that required only `validApiKey`: `GET /v1/system/env-dump`, `GET /v1/system`, and `GET /v1/system/vector-count`. This allowed a workspace-scoped credential to reach routes outside its intended OpenAI-compatible model/chat allowance, because the shared scope-denial guard was not attached there.
- Added `apiKeyOwnerIsAdmin` to all three routes. They now require an active administrator-owned key, consistent with the other sensitive system operations.
- Added `server/endpoints/api/system/index.test.js` to assert that all six system routes use both authentication and administrator authorization.
- Commits: `3242794ecd9b6d42e6570a630a1362af0852956d` (route guards) and `c5c1ad25cc48e679541e4034b640a73a75494c7d` (regression tests).
- Source changes are committed but tests have not been executed. Continue auditing all API route groups for routes that omit the shared guard; this finding shows that route-by-route verification is still necessary.


## API route declaration audit — 2026-10-16

- Re-inspected the registered route groups in `server/endpoints/api/index.js` and route declarations for auth, admin, system, workspace, document, workspace-thread, user-management, OpenAI-compatible, embed, and API-key management endpoints.
- Source-level scan found the expected auth-verification route uses `validApiKey` alone; it does not expose privileged data. All inspected administrative/workspace/document/embed/OpenAI routes declare the shared administrator guard. The three system information routes that did not are now guarded (see the remediation entry above).
- This is a declaration-level scan, not proof that every route behaves correctly at runtime or that every mounted API path is included in this inventory. The new system route tests and API-key scope tests are authored but unexecuted.
- Minor lint hygiene: renamed an unused authentication catch binding to `_error` (commit `abf10598744c3d4610d1de21ebacb80f23b9637f`).


## Security follow-up — fail-closed API key expiry validation (2026-10-16)

A defensive edge case was found in expiry enforcement: a non-null expiry value that could not be parsed produced `NaN`, and the previous comparison did not classify it as expired. Authentication now rejects invalid expiry values as well as expired/revoked keys. The public key metadata status also reports malformed expiry as `expired` rather than `active`.
- Added regression tests in `server/utils/middleware/validApiKey.test.js` and `server/endpoints/api/apiKeys/index.test.js`.
- Commits: `bd62229e4a4c1ad9222cc6ead45427a744f8cd61` (authentication), `3a69cb4d1a4a5053d485642ebd077a503794a4c7` (middleware test), `e86fc35a728b7a28313922a695807f5a1e921034` (safe metadata), `05da24af16857f79f4f27e099a4032114d604a73` (endpoint test).
- Static source review only; tests, lint, build, migrations, and runtime verification remain outstanding.


## API usage ledger foundation — 2026-10-16

Started the first implementation layer for durable API usage accounting:
- Added `api_usage_events` to `server/prisma/schema.prisma` and an SQLite migration with a unique request ID and indexes for key/time/status queries.
- Added `server/models/apiUsage.js` with a minimal start event and conditional, one-time finalization. The model whitelists persisted fields and intentionally does not accept prompts or credential values.
- Added unit tests for required fields, secret/prompt exclusion, non-negative usage values, explicit cost provenance, and duplicate-finalization behavior.
- Commits: `b97c285433c2b369bc16d94030b4e2412cf25137` (schema), `142feab9145b4169143a70bb0cbd4bc75d8a1aaa` (migration), `3b8575589524e03fab9e4645bd17182f7b281ab1` (model), `6ed0216580f2cdbba783f649f405958c537e406d` (tests).
- This is a storage foundation only: no API routes are wired to it yet, so usage is not being collected and no quotas/rate/spend limits are enforced. Migration and Prisma Client generation remain unapplied; tests/build/lint are unexecuted.


## 2026-10-16 — API usage capture integration

- Added an observe-only metering hook to `POST /v1/openai/chat/completions`, guarded by `ENABLE_API_USAGE_METERING=true` (default off).
- Records start, status, latency, workspace/key metadata, and recognized token counters for non-streaming responses; streaming records latency/status but token counts remain unknown at route level.
- Usage ledger failures do not block chat; prompts and raw provider errors are not written to the ledger. This is not quota/rate/spend enforcement.
- Commit: `b817f694693e4ceb907fa36c4e8d1e03fefc76e9`.
- Migration and Prisma Client generation remain outstanding. Tests, lint, build, and runtime checks have not been run. Keep the flag disabled until migration is applied and verified.


### Follow-up hardening — usage helper isolation

- Extracted the feature flag and safe token-counter normalization into `server/utils/apiUsageMetering.js`; added unit tests for default-off behavior, accepted counters, invalid values, and cost remaining unknown.
- Commits: `c20147e64471994a69a2fb9155f18e8f1ce66772` (helper), `fb103bf771482542b4b08df55acf5d5d64fbd945` (route refactor), `8212e7ef965d16a101240006451a551e826909e7` (tests).
- JavaScript source/test files were checked for parse syntax through the connected source content; this is not a substitute for running Jest, ESLint, Prisma migrations, or the app.


- Follow-up: added best-effort detection of client disconnects so open chat usage events can finalize as `aborted` rather than being marked completed; ordinary exceptions are recorded as failed. Commit: `fd8080ffa4979ae5995a6e1f5888a0cd0255b85e`. Runtime behavior is unverified.


## 2026-10-16 — Business analytics first implementation

- Added administrator-only `GET /v1/admin/business-analytics`, protected by `validApiKey` and `apiKeyOwnerIsAdmin`.
- Added `frontend/src/pages/Admin/BusinessAnalytics/index.jsx`, registered `/settings/business-analytics`, and added an admin-only Settings navigation item.
- Dashboard metrics include recorded API requests, completion/failure/abort status, completion rate, token counts, average latency, top models/providers, total users/active users, workspaces, API keys, and known-cost coverage.
- Added date range validation (maximum 366 days) and backend tests for authorization middleware, invalid ranges, aggregate response, and safe failure when the migration/client is unavailable.
- Revenue and profit are explicitly unavailable until billing and operating costs are integrated. Cost coverage is reported; unknown cost is never displayed as zero.
- Usage collection still defaults off and currently captures OpenAI-compatible chat completion only. Migration and Prisma Client generation are pending; Jest, lint, frontend build, and runtime checks have not been executed.


## Business analytics trend follow-up — 2026-10-16

- Added database-side daily aggregation for recorded API usage. The endpoint now returns daily request counts, completed/failed outcomes, tokens, and verified-cost coverage without loading the full event ledger into Node.
- The admin page now shows a daily activity bar chart/list for the latest 14 dates with recorded activity in the selected period.
- Corrected the completion-rate denominator to exclude in-progress events and use terminal outcomes only.
- Updated endpoint tests for daily trend output and query parameterization.
- Commits: `8c2b076ae2d4c71d0d1b27a3b6d201aaf8f6bd48`, `3dc3f39173989568580bb2059d06d7922b112763`, `5f762439d30e58b8d2cb5abaae867de10899d4a9`, `e9e7dba963428c7026ddaa2a8f5ba856f50a45af`.
- No Jest tests, lint, frontend build, Prisma generation/migration, or runtime checks have been executed. This remains unverified source code and is not production-ready.
