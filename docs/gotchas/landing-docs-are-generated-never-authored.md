`apps/landing/src/data/docs/` — including `nav.json` — is **build output**. A hand edit survives
until the next `npm test` (the landing prebuild runs `generate-docs`), then vanishes.

To add a concept page:

1. Write `docs/concepts/<slug>.md`.
2. Add the slug to **`CONCEPT_ORDER`** (reading order) **and** to **`whyKarmyq`** or **`howItWorks`**
   (nav placement) in `scripts/generate-docs.ts`.
3. Regenerate, then verify the produced page and nav entry.

Missing either list fails the doc-context drift gate.

⚠️ Do not record this as "grep-verify nav.json after every edit". That is the symptom's workaround,
and stating it that way has already caused one wrong instruction to be written into a design spec.
The file reverts *because it is generated*; the fix is always at the source.
