[object Object]

## Security hardening update — env-dump endpoint

- Follow-up review found that API-key authentication alone was insufficient: any valid key could trigger `dumpENV()`, which writes selected process environment values (including secrets) to a server-side `.env` file.
- Commit `9b86a9aa464f7d6da2bdf29fe43f1f5e3e5e5525` disables the direct env-dump action in production (HTTP 404) and removes the now-unused import from the route module. The existing production `updateENV()` persistence path is unchanged.
- Verified by re-fetching the source after commit. Tests, lint, and build have not been run.
