# Lebap AI API Hub — initial architecture

## Purpose

Provide a stable interface for external applications and AI agents to access approved model and agent capabilities while enforcing identity, permissions, usage limits, and operational visibility.

## Request lifecycle

1. Validate request size, content type, and schema.
2. Authenticate the client credential.
3. Resolve tenant/client identity and enforce credential scope.
4. Apply rate and concurrency limits.
5. Check quota and spend policy before calling a provider.
6. Select an eligible provider/model using configured policy.
7. Execute with bounded timeout/retry behavior.
8. Normalize provider output and errors.
9. Record usage, latency, outcome, and cost provenance.
10. Return a response with a request ID; never expose provider secrets or internal stack traces.

## Required concepts

- **Tenant/client:** the billing and isolation boundary.
- **Credential:** revocable secret with owner, scopes, status, created/last-used timestamps, and optional expiry.
- **Provider connection:** server-side configuration for a model provider; secret values must be kept out of API responses and logs.
- **Routing policy:** allowed models, priority, price/latency preferences, fallback rules, and provider health.
- **Usage event:** request ID, tenant, credential ID, provider/model, timestamps, status, usage metrics, and cost source.
- **Quota policy:** rate, concurrency, token/request allowance, and spend ceiling.
- **Audit event:** actor, action, target, timestamp, and safe metadata.

## Security boundaries

- Client credentials must never grant administrative access by default.
- Provider secrets are server-side only.
- Tenant ownership must be enforced in data access, not only in the UI.
- Authentication failures must not reveal whether a credential exists.
- Limit request body sizes and execution duration.
- Never execute arbitrary tools or URLs solely because a model requested them.
- Tool access should be allowlisted and scoped, with approval gates for high-impact actions.
- Do not log raw API keys, provider secrets, passwords, or full sensitive user content.
- Rate limits and spend limits must be enforced server-side before provider calls.

## Compatibility strategy

Keep existing AnythingLLM routes intact where practical. Introduce the Lebap AI Hub under a distinct versioned route namespace and add adapters around existing provider/model functionality rather than duplicating all provider integrations.

## Cost accounting

Keep these values separate:
- provider-reported usage,
- estimated cost based on a versioned pricing table,
- actual invoiced/provider-billed cost,
- customer charge.

Do not treat estimates as actual bills. Pricing changes must be timestamped/versioned so past usage can be reconciled.

## Reliability

- Set provider timeouts and bounded retries.
- Avoid retrying non-idempotent operations without an idempotency strategy.
- Use circuit breakers or temporary provider disablement for repeated failures.
- Track success rate, latency, rate-limit responses, and provider errors.
- Return stable public error codes and a request ID, not raw stack traces.

## Release requirements

The API Hub is not production-ready until tenant-isolation tests, credential lifecycle tests, quota/spend enforcement tests, provider failure tests, secret scanning, and deployment smoke tests pass.
