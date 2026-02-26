---
name: update-handoff
description: Update the CURRENT_HANDOFF.md document to reflect the current session's completed work, remaining tasks, and next steps. Use this at the end of every session, or when the user asks to update the handoff.
---

Update the handoff document at `.claude/handoff/CURRENT_HANDOFF.md` for the next session.

## Steps

1. **Read current handoff**: `cat .claude/handoff/CURRENT_HANDOFF.md`

2. **Check recent git log**: `git log --oneline -10` to see what was committed this session

3. **Update the document**:
   - Move completed items to "✅ Already Implemented" (or a "What We Just Completed" section)
   - Update "❌ Not Yet Implemented" to reflect what's left
   - Update the "Quick Start" section so the next session can begin immediately without context-gathering
   - Update the date at the top
   - If a phase/sprint is fully complete, mark it complete and start the next phase section

4. **Verify the handoff is actionable**: The next session should be able to read only CURRENT_HANDOFF.md and know exactly what to do next.

## What a good handoff contains
- What was just completed (specific files changed, decisions made)
- Why key decisions were made (so next session doesn't re-debate them)
- What's next (concrete first steps, not vague directions)
- Key file paths and line numbers for the next task
- Any blockers or open questions

## Template reference
See `.claude/handoff/TEMPLATE.md` for the full structure.
