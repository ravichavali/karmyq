# Karmyq Ideas & Open Questions

A running log of transient ideas captured mid-session. Use `/capture <idea>` to add entries.

---

## [2026-02-28] framing

"remembers" language should be reframed across trust/karma docs — shift from surveillance framing ("the system remembers your contributions") to meaning framing ("acts are ephemeral, their impact persists in the community"). Affects: trust-score.json, what-is-karma.json, platform-overview.json.

---

## [2026-02-28] framing

platform-overview.json has absolutist "not through money" framing that predates the service provider layer. Needs a dedicated session to soften it — acknowledge the two-layer model without undermining the mutual aid core message.

---

## [2026-02-28] skill-idea

A `/capture` skill (this one!) — drops ideas into a persistent scratchpad across conversations so nothing gets lost mid-task.

---

## [2026-03-01] open-question

Community trust score visibility — public to non-members or admin-only? (ADR-040 open question, not yet resolved.)

---

## [2026-03-04] architecture

Provider templates: `simulation/workflows/data.ts` has rich request templates (`title`, `description`, `urgency`, `type_payload`) via `pickRequest()`, but `registerAsProvider` uses small hardcoded arrays in `workflows/index.ts` (`PROVIDER_DISPLAY_NAMES`, `PROVIDER_BIOS`). Move provider seed data into `data.ts` as `PROVIDER_TEMPLATES` with richer fields: `service_type`, `display_name`, `bio`, `pricing_notes`, `location_notes`. Expose via a `pickProvider()` helper matching the `pickRequest()` pattern.

---

## [2026-03-04] open-question

Karma vs trust consistency: karma (reputation-service) and trust scores (social-graph-service) are two separate systems — separate APIs, separate score fields, no defined relationship. Need a design session: what's the conceptual difference? Does karma feed into trust? Should there be one unified "standing" concept? Affects ADR-011 (reputation decay), ADR-040 (community trust), platform-overview framing, and any future provider trust scoring.

---
