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
