# Lebap AI User Guide

Lebap AI is an AI workspace and agent platform for connecting model providers, working with knowledge sources, and configuring tools and integrations.

This guide is maintained in the Lebap AI repository. The project is based on an open-source foundation and retains certain legacy implementation identifiers for compatibility with existing installations.

## Getting started

1. Open your deployed Lebap AI instance and complete the onboarding steps.
2. Configure a supported language model provider in **Settings → LLM Preference**.
3. Configure an embedding provider and vector database if you plan to index documents.
4. Create a workspace, add documents or other knowledge sources, and test retrieval before relying on the results.
5. Configure access controls and review the security settings before exposing the instance to other users.

Provider credentials should be stored in server-side environment variables or the platform's secret settings. Never place API keys in frontend code, commit them to the repository, or share them in issue reports.

## Model providers and integrations

Open **Settings** to configure the model provider, embedding provider, transcription, text-to-speech, image generation, and supported external connections. Each provider has its own credential and endpoint requirements; follow that provider's official documentation for its API details.

A provider's name or logo in a provider-selection screen identifies the external service, not the Lebap AI product brand.

## MCP tools and external agents

MCP integrations allow the platform to connect to supported external tools. Only connect servers you trust, review their requested capabilities, and avoid granting access to secrets or files that are not needed. Treat tool output as untrusted input and keep permissions as narrow as possible.

For agent workflows, configure only the tools required for the task and test the workflow with non-sensitive data first. Availability and behavior depend on the configured provider, agent, and enabled features.

## Agent skills

Some skills may require additional OAuth credentials, API keys, or local configuration. Review the required permissions before enabling them. Do not paste passwords or long-lived secrets into prompts or shared logs.

## Deployment and persistence

Use the deployment instructions and environment examples in this repository. Configure persistent storage before running the service in a production environment. Back up the database and uploaded documents before upgrades.

Some filenames, database names, environment variables, package dependencies, and deployment resource identifiers still use legacy upstream names. These identifiers are intentionally retained where changing them could break existing installations or cause data loss; they are not the public Lebap AI brand.

## External services and data flow

- The Community Hub integration still relies on an upstream hosted service; it is not hosted by Lebap AI.
- The optional onboarding questionnaire currently sends submitted answers to an external upstream survey service. The onboarding screen discloses this before submission; skip the survey or avoid sensitive information if you do not want to share those details.
- Telemetry is disabled unless the server operator configures LEBAP_AI_TELEMETRY_KEY. Review the configured destination and event properties before enabling it.

## Troubleshooting

- Check the application and server logs for the first relevant error, not only the final failure message.
- Confirm the selected provider's credentials, base URL, and model name.
- Confirm the deployment has writable persistent storage and that database migrations completed.
- For bugs and feature requests, open an issue in the [Lebap AI repository](https://github.com/LebapAI/Lebap-AI/issues).

## Project source

- [Source code](https://github.com/LebapAI/Lebap-AI)
- [Issue tracker](https://github.com/LebapAI/Lebap-AI/issues)
- [Project README](https://github.com/LebapAI/Lebap-AI#readme)
