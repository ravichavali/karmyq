# Reusable Prompts

Quick-copy prompts for common workflows. Paste into any session as needed.

---

## Session Start

```
Read HANDOFF.md and summarize: 1) What was completed last session, 2) What are the current blockers, 3) What are the prioritized next tasks. Then tell me what you recommend we tackle first.
```

---

## Bug Fixing

### Grep-first (for hardcoded values, config, URLs)
```
Before fixing this bug, grep the entire codebase for all occurrences of the problematic value. List every file that needs to change, then fix them all in one pass. Do not commit until you've verified no other files contain the old value.
```

### Root cause before code
```
Before writing any code, explain: 1) What is the root cause of this bug? 2) What is the full data flow involved? 3) Which files/layers need to change? Only after I confirm your diagnosis, proceed with the fix.
```

### Test-driven bug fix (autonomous)
```
I have a bug: [describe symptom and where you see it]. Before attempting any fix, first: 1) Read the relevant source files and trace the data flow end-to-end, 2) Write a failing test that reproduces the exact bug, 3) Run the test suite to confirm it fails, 4) Implement the fix, 5) Run the full test suite to confirm the fix passes AND no regressions. Do NOT propose a fix until you've confirmed the test fails. If your fix doesn't pass, iterate up to 5 times before asking me for help. Show me the test output at each stage.
```

---

## Multi-File Impact Analysis

```
Before making any changes, I need you to do a full impact analysis. The issue is: [describe the problem]. Step 1: Use Grep to find EVERY file that references the relevant values, components, or patterns — not just the obvious ones. Step 2: For each file found, Read it and determine if it's a source-of-truth, a generated file, or a consumer. Step 3: Present me a table of all affected files, what needs to change in each, and the correct order of changes. Step 4: Only after I approve, make ALL changes in one pass and run the test suite. Flag any generated files that should not be hand-edited.
```

---

## Deploy

```
I want to deploy the latest changes to [staging/production]. Run this full pre-deploy pipeline autonomously: 1) Create a TodoWrite checklist of all steps. 2) Run TypeScript build for ALL services — stop and fix any type errors before continuing. 3) Run the full test suite. 4) Dry-run any pending database migrations and verify they apply cleanly. 5) Check that all environment variables and config templates are consistent across environments. 6) Build Docker images and verify health check endpoints respond. 7) Only after all gates pass, show me a deploy-ready summary with any warnings. If any step fails, fix it and re-run that step before moving on. Do not skip steps.
```
