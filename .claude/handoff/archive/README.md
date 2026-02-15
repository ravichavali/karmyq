# Archived Handoffs

This directory contains completed handoff documents for reference.

## Naming Convention

`YYYY-MM-DD-feature-name.md`

Example: `2026-02-15-server-driven-ui.md`

## When to Archive

When a feature is complete, move the handoff here:
```bash
mv .claude/handoff/CURRENT_HANDOFF.md .claude/handoff/archive/$(date +%Y-%m-%d)-feature-name.md
```

## Why Archive?

- **Reference**: See how previous features were implemented
- **Patterns**: Learn from successful handoffs
- **History**: Track what was worked on and when
