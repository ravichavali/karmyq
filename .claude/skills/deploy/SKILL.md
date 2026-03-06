# Deploy to Staging

Run the full pre-deploy verification pipeline before pushing to karmyq.com.

1. Run `npx tsc --noEmit` across all services with changed files — fix any type errors before continuing
2. Run the full test suite: `npm test` (unit + regression must pass)
3. Check for uncommitted changes: `git status`
4. Run deploy: `git push origin master` (triggers GitHub Actions CI/CD)
5. Monitor the pipeline: `gh run list --limit 3` — wait for green
6. Verify health: `npm run health:check` or check `https://karmyq.com/health`
7. Update `CURRENT_HANDOFF.md` with deployment status and any post-deploy notes
