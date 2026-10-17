# Lebap AI — API Security Review

**Reviewed:** 2026-10-17  
**Working branch:** `lebap-ai/organized`  
**Review type:** source-level review; not a penetration test or production approval.

## Controls found in source

- New API-key secrets are hashed before storage; the raw value is returned only at issuance. Legacy plaintext-key lookup remains for compatibility.
- API keys support expiry and soft revocation, and authentication rejects expired/revoked credentials and invalid expiry values.
- Workspace allowlists are parsed through shared scope helpers. Empty/malformed stored scopes fail closed; legacy NULL/undefined scope remains unrestricted for compatibility.
- API-key management hides reusable secret material from standard listing responses.
- New key creation UI supports workspace selection and expiry choices.
- Sensitive system routes use administrator-owned-key authorization.
- A shared fixed-window API-key request rate limiter and persistent rate-limit window schema are present in source.
- Observe-only usage capture and an initial admin analytics surface are present; usage capture is not billing or spend enforcement.

## Material risks still open

1. **Legacy unrestricted credentials:** NULL workspace scopes preserve broad access. Inventory, rotate/restrict, and test these before treating the platform as tenant-isolated.
2. **Legacy plaintext secrets:** old raw-secret records remain accepted. Plan controlled rotation and removal without silently breaking clients.
3. **Complete route coverage:** route declarations and tests must be audited systematically across every mounted route and indirect access path. Existing review notes are not proof of exhaustive coverage.
4. **Rate limiter deployment properties:** validate atomicity, multi-instance behavior, concurrency, expiry/cleanup, storage outages, and bypass resistance. Do not assume an in-process or database-backed window is production-safe without tests.
5. **Quotas and spend:** there is no verified end-to-end pre-provider quota, concurrency, token budget, or hard spend cap.
6. **Tenant/client model:** workspace allowlists do not replace a complete tenant identity and authorization model across all APIs.
7. **Usage and costs:** event capture is best-effort and feature-flagged. Unknown costs must remain unknown; analytics is not billing.
8. **Database lifecycle:** validate migrations and Prisma Client generation on a disposable database first; confirm supported database configuration and migration order.
9. **Runtime verification:** current branch CI is running; do not claim tests/build passed until the exact current head has completed successfully.

## Required release gates

- Route-by-route access-control matrix with tests for each route class and middleware order.
- Legacy-key inventory/rotation plan and migration rollback strategy.
- Rate-limit tests for concurrency, multiple instances, storage errors, and boundary conditions.
- Tenant/workspace isolation tests across all supported endpoints.
- Prisma schema validation/client generation and controlled migration tests.
- Full backend test suite, frontend production build/lint, dependency/secret scans, and deployment smoke tests.
- Monitoring, backup/restore drill, secret management, and licensing review.

## Verification boundary

This document summarizes source findings and known gaps only. It does not certify that tests pass, migrations have been applied, rate limiting is production-ready, or the application is safe for untrusted multi-tenant use.
