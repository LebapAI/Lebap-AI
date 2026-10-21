# Lebap AI Security Policy

Lebap AI is under active development. Do not assume that every feature or deployment configuration has been security-reviewed for production or untrusted multi-tenant use.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/LebapAI/Lebap-AI/security/advisories/new). Do not publish exploit details, credentials, personal data, or proof-of-concept payloads in a public issue.

Include, where possible:

- The affected commit, version, endpoint, or deployment type.
- The security impact and realistic attack conditions.
- Minimal reproduction steps that do not expose real user data.
- Any suggested mitigation.

Please allow maintainers time to investigate before public disclosure. Low-risk bugs and non-sensitive hardening suggestions can be reported through the [public issue tracker](https://github.com/LebapAI/Lebap-AI/issues).

## Deployment guidance

- Keep the server and its dependencies updated.
- Use TLS and strong authentication before exposing an instance to a network.
- Store API keys and database credentials in server-side secrets, never in frontend code or public repositories.
- Limit access to uploaded documents, workspace data, logs, and external tools.
- Grant MCP servers and agent tools only the permissions they need.
- Review telemetry and external integrations before deploying with sensitive data.
- Back up persistent storage and test restoration before upgrades.

## Scope and supported versions

The project is actively evolving. Until formal release and support policies are published, the current main branch is the primary development target. Security fixes may require users to update to a newer commit. This policy does not replace a security review of a particular deployment.
