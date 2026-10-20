# API Hub Usage Metering — Historical Notes

This file records the former chronological metering-design document that was consolidated on 2026-10-20. It is archival context, not current implementation status.

The previous document covered:
- the original tenant/client and API credential design;
- the append-oriented `api_usage_events` schema and migration;
- feature-flagged, observe-only chat metering;
- handling of stream disconnects and finalization;
- API-key expiry, revocation, secret hashing, and workspace allowlists;
- fixed-window API request rate limiting;
- prior verification statements, including statements that later became stale or contradictory.

The current specification is maintained in `docs/architecture/API_HUB_USAGE_METERING.md`. Current status and release gates there supersede all historical statements. Relevant commit history remains available in GitHub.
