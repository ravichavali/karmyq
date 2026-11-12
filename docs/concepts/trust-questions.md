# Trust Questions

The trust model questionnaire that founders answer when creating a community is not hardcoded into the app — it lives in the database as a set of questions and choices, each with a `config_delta` that describes which configuration fields the answer affects.

---

## How It Works

When a community is created (or a founder revisits the trust model), they answer a series of questions. Each answer maps to one or more configuration fields. The system merges all selected answers in `display_order` ascending order to produce the final `CommunityConfig`.

This merge strategy means later questions (higher `display_order`) can override earlier ones. Question 6 (`request_curation`, display_order 50) intentionally overrides the `request_approval_required` value that Question 2 (`new_member_warmth`) may have set — the founder's explicit curation preference wins.

---

## The Six Questions

| # | Slug | display_order | What it configures |
|---|------|---------------|--------------------|
| 1 | `who_is_this_for` | 10 | Visibility mode, join approval, member cap, outsider response |
| 2 | `new_member_warmth` | 20 | New member karma lockout days, initial request approval |
| 3 | `relationship_style` | 30 | Trust depth/breadth weights |
| 4 | `asking_for_help` | 40 | Karma splits (helper vs. requestor) |
| 5 | `generosity_memory` | 45 | Karma and trust decay half-lives |
| 6 | `request_curation` | 50 | Request approval required (final override) |

---

## Config Delta Pattern

Each choice stores a `config_delta` — a partial `CommunityConfig` object. When an answer is selected, its delta is merged into the running config. This means:

- A choice can set multiple fields at once
- Later questions override earlier ones for any overlapping fields
- Unanswered questions contribute no delta (safe default)

Example: choosing `admin_review` for Q6 sets `{ request_approval_required: true }`, overriding whatever Q2 set.

---

## Admin Management

Only **platform admins** edit the questionnaire, because one set of questions serves every community. A platform admin
is a role an operator grants explicitly (a row in `auth.platform_admins`). Creating or administering a community does
not make you one (ADR-105, Sprint 141). Communities still answer the questionnaire when they are created, and revisit
their answers later.

Platform admins manage questions and choices in the admin UI at `/admin/trust-questions`. From there, they can:

- Edit question text, subtext, and display order
- Toggle questions active/inactive
- Edit choice labels, descriptions, and `config_delta` values
- Add new choices or questions

Changes take effect immediately for new community creation flows. Existing communities are unaffected until they revisit their trust model.

---

## API

The questions endpoint is public (no auth required for reading):

```
GET /communities/trust-questions
```

Returns all active questions ordered by `display_order`, each with their active choices.

Write operations (create, update, delete) need a signed-in **platform admin**, checked live against
`auth.platform_admins` on every request. Anyone else, including a community admin, gets `403` with
`"error": "PLATFORM_ADMIN_REQUIRED"`.
