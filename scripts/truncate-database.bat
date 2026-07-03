@echo off
REM Sprint 117: the legacy full-truncate is replaced by the single guarded demo reset.
REM The old script disabled constraints and truncated a stale table list with no fingerprint,
REM backup, advisory lock, or transaction. This wrapper delegates to the guarded reset.
REM
REM   scripts\truncate-database.bat                dry-run plan
REM   scripts\truncate-database.bat --apply        guarded destructive reset (approved downtime)

echo.
echo [deprecated] truncate-database.bat delegates to the guarded curated demo reset.
echo Read-only plan by default; add --apply for the destructive path.
echo.

npm --workspace @karmyq/simulation-service run reset:demo -- %*
