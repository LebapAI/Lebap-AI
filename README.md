# Lebap AI

**An extensible AI workspace and agent platform — under active development.**

Lebap AI brings model providers, knowledge bases, AI agents, tools, and developer APIs together in one platform. The project builds on the open-source foundation of [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) and is being extended toward a unified platform for AI applications and agents.

> **Development status:** Lebap AI is not production-ready for untrusted multi-tenant API customers. API Hub authorization coverage, tenant isolation, quota and spend enforcement, database migrations, integration tests, and deployment verification still require completion. Do not use this repository snapshot as evidence of production security or billing accuracy.

## Project goals

The long-term product roadmap includes:

- **Model providers and routing** — connect supported hosted and local models, with a consistent path toward policy-based routing.
- **AI agents** — create, configure, and manage agents that use approved tools.
- **Multi-agent orchestration** — coordinate specialized agents with bounded execution, tracing, timeouts, and cancellation.
- **MCP and external tools** — connect tools with explicit permissions and controlled access.
- **API Hub** — provide a stable, versioned interface for applications, bots, and AI agents.
- **Knowledge and retrieval** — work with documents, workspaces, embeddings, and retrieval-augmented generation (RAG).
- **Workflow automation** — build repeatable processes with execution history and failure handling.
- **Agent and tool catalog** — discover and manage reusable capabilities.
- **Administration and analytics** — manage access, observe usage, and build reliable operational and business metrics.
- **Security and extensibility** — enforce least privilege, protect secrets, audit important actions, and support maintainable integrations.
- **Unified responsive interface** — deliver a consistent experience across desktop and mobile browsers.

These are product goals, not a claim that every capability is complete. See the implementation matrix and progress notes for the current status.

## Current implementation snapshot

The repository contains an existing AI workspace application and partial Lebap AI-specific work, including:

- Existing provider, document, workspace, and agent-related functionality inherited from the upstream foundation.
- API-key lifecycle controls in source, including expiry, soft revocation, hashed storage for newly issued keys, and workspace allowlists.
- OpenAI-compatible routes for chat completions, image generation/editing, embeddings, model listing, and vector-store listing.
- Feature-flagged, observe-only usage event capture for selected OpenAI-compatible operations.
- An initial admin business-analytics endpoint and page.
- Initial Lebap AI branding and API/security architecture documentation.

**Important limitations:** legacy credentials and legacy unrestricted workspace scopes still require a migration plan; workspace-scope enforcement has not been proven across every route; usage capture is not billing or budget enforcement; provider costs are not automatically verified; and database migrations, full tests, builds, and runtime behavior must be validated before release.

## Working branch and engineering status

- **Stable branch:** `main` remains unchanged during review.
- **Current branding migration:** `brand/official-logo-assets`, tracked in [PR #3](https://github.com/LebapAI/Lebap-AI/pull/3). Merge only after checks pass.
- **Capability matrix:** [`docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md`](docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md)
- **Current engineering status:** [`docs/LEBAP_AI_PROGRESS.md`](docs/LEBAP_AI_PROGRESS.md)
- **Repository layout and migration baseline:** [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md)
- **Historical engineering notes:** [`docs/archive/LEBAP_AI_PROGRESS_HISTORY.md`](docs/archive/LEBAP_AI_PROGRESS_HISTORY.md)

## Repository structure

| Path | Purpose |
| --- | --- |
| `server/` | Node.js/Express API, provider integrations, application services, and Prisma schema/migrations |
| `frontend/` | React/Vite web application |
| `collector/` | Supporting collection/service component |
| `docker/` | Docker-related configuration and deployment resources |
| `docs/` | Product implementation, architecture, progress, and security reviews |

## Requirements

Check the dependency and environment files for the requirements of the version you are using. The root package currently declares **Node.js 18 or newer**; the server package declares **Node.js 18.12.1 or newer**. Install a compatible Yarn version for this repository and use the package manager/lockfiles supplied by the project.

You will also need configuration appropriate to the model provider, vector database, and other services you choose to enable. Never commit API keys, passwords, provider credentials, production database URLs, or populated environment files.

## Local development

From the repository root:

1. Install dependencies and create local environment files:

   ```bash
   yarn setup
   ```

   Review the generated environment files and configure the values required by your selected providers and storage services. Do not paste production secrets into issue reports or commit them.

2. Start the server, frontend, and collector in separate terminals:

   ```bash
   yarn dev:server
   yarn dev:frontend
   yarn dev:collector
   ```

   Alternatively, the root package defines a combined `yarn dev` command. Use the separate commands when diagnosing startup failures.

3. Follow the startup logs and the configured local environment for service URLs and database setup. Do not assume that a successful frontend startup proves the API, database, model provider, or migrations are healthy.

The setup scripts include Prisma generation, database migration, and seeding. Run them only against a local or disposable development database until the migration sequence has been reviewed and validated for the target environment.

## Useful commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `yarn test` | Run the root Jest test command |
| `yarn lint:ci` | Run non-fixing lint checks for server, frontend, and collector |
| `yarn prod:frontend` | Build the frontend |
| `yarn prisma:generate` | Generate Prisma Client |
| `yarn translations:verify` | Verify translation consistency |

These commands describe the scripts declared in the repository. They are **not** a claim that the current branch has passed them. Record the results from a clean checkout before treating a change as verified.

## API Hub

The API Hub is intended to let external applications, bots, and agents access approved capabilities using scoped credentials and predictable responses.

The current source includes OpenAI-compatible endpoints under `/v1/openai`, API-key management, and an initial usage ledger. Exact route behavior and required configuration should be confirmed from the current source and generated API documentation.

The usage feature is controlled by the server environment flag:

```env
ENABLE_API_USAGE_METERING=true
```

Usage capture is **observe-only**. Enabling it does not enforce rate limits, concurrency limits, quotas, customer billing, or spending ceilings. Cost values must not be treated as verified provider invoices unless their source is explicitly validated.

Before exposing the API Hub to external or multi-tenant customers, the project must pass route-by-route authorization review, workspace/tenant-isolation tests, credential migration checks, quota and spend-control tests, provider failure tests, migration validation, and deployment smoke tests.

## Security principles

- Keep provider credentials and application secrets on the server.
- Never log or return raw API keys, provider secrets, passwords, or sensitive user content.
- Use least-privilege credentials and explicitly scope access to the required resources.
- Treat model output, retrieved documents, and external tool responses as untrusted input.
- Apply rate, concurrency, execution-time, and spending controls on the server before paid operations.
- Record security-relevant events without storing secrets.
- Validate migrations and test changes against a disposable database before applying them to valuable data.
- Report suspected vulnerabilities privately to the repository maintainers rather than publishing exploit details.

The security documents describe source-level findings and known gaps; they are not a penetration-test report or production approval.

## Documentation

- [Implementation matrix](docs/LEBAP_AI_IMPLEMENTATION_MATRIX.md) — status and acceptance criteria for the product roadmap.
- [Implementation plan](docs/LEBAP_AI_IMPLEMENTATION_PLAN.md) — planned delivery stages.
- [Development progress](docs/LEBAP_AI_PROGRESS.md) — implementation notes and verification boundaries.
- [API Hub architecture](docs/architecture/API_HUB.md) — intended request lifecycle, security boundaries, and release gates.
- [Usage metering design](docs/architecture/API_HUB_USAGE_METERING.md) — usage-event design and rollout considerations.
- [API route review](docs/security/API_ROUTE_REVIEW.md) — route-level security review.
- [API security review](docs/security/API_SECURITY_REVIEW.md) — known controls, risks, and remediation priorities.

Documentation may include historical notes. When statements conflict, use the latest dated status and verify the implementation at the exact commit being evaluated.

## Upstream foundation and licensing

Lebap AI builds on the [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) open-source project. Review the repository's [LICENSE](LICENSE) and relevant third-party notices before redistributing or deploying the software. Preserve required upstream attribution and comply with all applicable licenses.

## Contributing

Work in focused changes that include tests and documentation. For security-sensitive changes, add regression tests for both permitted and denied behavior. Do not mark a feature complete until its implementation, migration (if any), tests, build, and runtime behavior have been checked.

Before proposing a production release, require a clean-checkout verification record covering dependency installation, Prisma generation, migration application, server tests, lint, frontend build, authorization and isolation tests, provider failure handling, secret scanning, and deployment smoke tests.

---

**Lebap AI is under active development.** The roadmap describes the intended product; the current code, tests, and verification records determine what is actually ready.
