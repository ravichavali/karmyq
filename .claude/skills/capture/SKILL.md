---
name: capture
description: Capture a transient idea, design note, or open question to docs/IDEAS.md so it persists across conversations. Use when the user says "remember this", "note that", "keep track of", or shares an idea mid-task that shouldn't be lost.
disable-model-invocation: false
---

Append the idea to `docs/IDEAS.md` with today's date and a short category tag.

## Format

```
## [YYYY-MM-DD] <category>

<idea text, verbatim or lightly cleaned up>

---
```

**Categories**: `framing` | `ux` | `architecture` | `skill-idea` | `docs` | `open-question` | `other`

## Steps

1. Read `docs/IDEAS.md` if it exists (create if not)
2. Determine the best category from the idea content
3. Append the new entry at the bottom with today's date
4. Confirm to the user: "Captured under [category] in docs/IDEAS.md"

Do NOT reorganize existing entries. Append only.
Do NOT start a long discussion — just capture and confirm in one short message.

## Example invocations

- `/capture the "remembers" framing should become "ephemeral acts, lasting impact" across trust/karma docs`
- `/capture idea: /note-taking skill that persists ideas cross-session`
- `/capture open question: should community trust scores be public or admin-only?`
