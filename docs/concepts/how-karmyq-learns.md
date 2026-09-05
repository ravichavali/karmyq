# How Karmyq Learns

Code has a mechanism for staying true. It evolves through commits, it is checked by review, and
tests fail when it rots. Nobody has to remember to keep it honest — the machinery does that.

Operational knowledge has no such mechanism. The habits, the hard-won facts, the "don't do that,
here's why" — these accumulate in whoever happened to be present when the lesson was paid for.
They are learned repeatedly, by each person, at full cost. And an external contributor who forks
the repository can never receive them at all: they are not in the code, not in the history, and
not in any file the clone carries.

That asymmetry is the problem. A project that is open source in its licence but closed in its
know-how is only half open.

## The answer is a home, a review path, and a rot-check

`docs/gotchas/` is where this project's operational knowledge lives. Each entry is a pair of
files — a small JSON sidecar describing the fact, and a Markdown body explaining it, including
the evidence that made us believe it. Adding one is a pull request, reviewed like any other change.

Being written down is not enough, though. Documentation that nobody checks becomes confidently
wrong, which is worse than absent — absent knowledge sends you looking, while wrong knowledge
sends you somewhere specific and incorrect.

So every entry carries **exactly one** of two things:

- **A machine check.** A declarative assertion the build can evaluate — a file exists, a file
  matches a pattern, a JSON key holds a value. If the fact stops being true, the build fails and
  names the entry.
- **A review date.** For facts a machine cannot check — the behaviour of an external service, say —
  an explicit date by which a human must re-confirm it. Renewing requires stating how it was
  re-confirmed, not merely moving the date.

An entry that can be checked, is. An entry that cannot be checked, expires. Nothing sits in the
directory quietly decaying.

## What is deliberately not here

The checks are **declarative only** — four fixed kinds, no free-form commands. This is a public
repository that accepts pull requests from forks, and a check that could run an arbitrary string
would be arbitrary code execution wearing a documentation costume.

The validator also performs **no network I/O**. A gate that depends on an external service is a
gate that fails when that service does, which is exactly when you least want to be blocked.

And nothing summarises these entries. Discovery points you at the entry itself; it never
paraphrases. A summary layer drifts away from what it summarises, and looks authoritative while
doing it.

## Using it

Ask what applies to the code you are about to touch:

```bash
node scripts/gotcha-check.js --for <paths you are changing>
```

It answers for files that do not exist yet, which is the case directory-scoped knowledge exists
for — the moment before you create something is exactly when you want to know the rule.

The point is not the directory. The point is that a `git clone` becomes the only distribution
mechanism this knowledge needs.
