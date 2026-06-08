---
name: bug
description: Log a bug to docs/BUGS.md mid-session without derailing current work, so it persists across conversations and can be planned later. Use when the user says "log a bug", "found a bug", "/bug ...", or reports broken behavior they want tracked rather than fixed right now.
disable-model-invocation: false
---

Append the bug to `docs/BUGS.md` with a sequential id and today's date. Capture and confirm — do NOT investigate, reproduce, or fix.

## Format

```
## BUG-NNN · [YYYY-MM-DD] · open

<bug text, verbatim or lightly cleaned up>

---
```

- `BUG-NNN` — next id after the highest existing `BUG-` number (zero-padded to 3 digits). First entry is `BUG-001`.
- `open` is always the status at capture time. Planning/fixing later hand-edits it to `planned` or `fixed`.

## Steps

1. Read `docs/BUGS.md` if it exists (create with the header below if not).
2. Find the highest existing `BUG-NNN` id and increment by one. If none, start at `BUG-001`.
3. Append the new entry at the bottom with the next id and today's date.
4. Confirm in one short line: `Logged BUG-NNN in docs/BUGS.md`.

Do NOT reorganize or edit existing entries. Append only.
Do NOT start debugging, reproducing, or fixing — this skill only captures.
Do NOT start a discussion — capture and confirm in one short message.

## Header (only when creating the file)

```
# Karmyq Bug Log

A running list of bugs captured mid-session. Use `/bug <description>` to add entries.
Status is `open` at capture; planning sessions hand-edit to `planned` or `fixed`.

---
```

## Example invocations

- `/bug feed 500s when trust weight config has a 0 value`
- `/bug community page overview tab flashes empty before data loads`
- `/bug mobile: join-community button stays disabled after a successful join`
