# Contributing to Lebap AI

Lebap AI is an open-source AI workspace and agent platform built on an existing open-source foundation. Please preserve applicable upstream copyright notices and license terms when modifying inherited code.

## Reporting bugs and requesting features

- Open an issue in the [Lebap AI issue tracker](https://github.com/LebapAI/Lebap-AI/issues).
- Include reproducible steps, expected behavior, actual behavior, relevant logs, and the affected commit or deployment version.
- Remove API keys, passwords, access tokens, private documents, personal data, and production URLs containing secrets before sharing logs.

## Security reports

Do not publish exploitable vulnerabilities in public issues. Use [GitHub Security Advisories](https://github.com/LebapAI/Lebap-AI/security/advisories/new) for private reporting.

## Development setup

Requirements are defined by the package and environment files. The current root project requires Node.js 18 or newer; the server requires Node.js 18.12.1 or newer and Yarn.

1. Clone this repository:
   git clone https://github.com/LebapAI/Lebap-AI.git
2. Enter the repository:
   cd Lebap-AI
3. Install dependencies and initialize local environment files:
   yarn setup
4. Configure local environment files with test credentials. Never commit populated .env files.
5. Start the server, collector, and frontend using the scripts documented in the root README.

## Before opening a pull request

- Create a focused feature branch; do not make unreviewed changes directly on main.
- Keep changes scoped and explain any migration or compatibility implications.
- Run relevant checks where possible:
  - yarn lint:ci
  - yarn test
  - yarn prod:frontend
  - yarn translations:verify
- Update documentation and tests when behavior or public APIs change.
- Do not include secrets, user data, generated build output, or unrelated formatting changes.
- Preserve existing storage, database, environment-variable, API, and MIME-type compatibility unless a migration is explicitly implemented and documented.

## Pull request expectations

Describe the problem, the approach, the affected areas, compatibility considerations, and the checks performed. Clearly identify checks that could not be run. Do not claim that a build, test, security review, or deployment passed unless its result was verified.

## Licensing

By contributing, you agree that your contributions may be distributed under the repository's MIT license. Existing upstream notices and third-party licenses must remain intact.
