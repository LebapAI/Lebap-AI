[object Object]

## Security hardening update — env-dump endpoint

- Follow-up review found that API-key authentication alone was insufficient: any valid key could trigger `dumpENV()`, which writes selected process environment values (including secrets) to a server-side `.env` file.
- Commit `9b86a9aa464f7d6da2bdf29fe43f1f5e3e5e5525` disables the direct env-dump action in production (HTTP 404) and removes the now-unused import from the route module. The existing production `updateENV()` persistence path is unchanged.
- Verified by re-fetching the source after commit. Tests, lint, and build have not been run.


## Security hardening update — system API response redaction

- Found that `POST /v1/system/update-env` echoed submitted setting values in its `newValues` response, potentially reflecting provider credentials to API callers.
- Commit `f65397f106221dba22104184892d9d7111bda464` redacts likely secret fields at the API response boundary, returning booleans for presence rather than secret contents. Actual setting updates are unchanged.
- Together with the env-dump endpoint hardening, this is a targeted static security improvement. Tests/lint/build remain unexecuted.
