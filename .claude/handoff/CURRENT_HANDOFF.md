# Server-Driven UI (Dynamic Forms) - PHASE 2 COMPLETE ✅

## Implementation Summary (Completed: 2026-02-18)

**Feature**: Server-Driven UI / Dynamic Forms (Roadmap Phase 2)
**Current Version**: v9.1.0
**Status**: Phase 2 Complete → Phase 3: Web App Completion (NEXT)
**Complexity**: Medium | **Impact**: High | **Timeline**: 8 weeks total (Weeks 1-4 done, 4 remaining)

---

## ✅ Phase 1: Database & Backend API - COMPLETE (2026-02-15)

Summary:
- Database: `infrastructure/postgres/migrations/015_ui_schemas_dynamic.sql`
- SchemaService with DB-first loading + code fallback + caching
- Admin API: `/admin/schemas` (CRUD, publish, archive, rollback, variants)
- Admin auth middleware: `services/request-service/src/middleware/adminAuth.ts`
- ADR-032: `docs/adr/ADR-032-server-driven-ui-dynamic-schemas.md`

---

## ✅ Phase 2: Admin UI - COMPLETE (2026-02-18)

### Files Created
1. **Admin Components** (`apps/frontend/src/components/admin/`)
   - `AdminLayout.tsx`, `SectionList.tsx`, `SectionHeader.tsx`, `SectionEditor.tsx`
   - `FieldEditor.tsx`, `FieldList.tsx`, `LivePreview.tsx`
   - `PublishDialog.tsx`, `ArchiveDialog.tsx`

2. **Admin Pages** (`apps/frontend/src/pages/admin/schemas/`)
   - `index.tsx` - Schema list with filtering
   - `new.tsx` - Schema creation wizard
   - `[id]/edit.tsx` - Schema editor (sections/fields/preview/versions tabs)
   - `[id]/versions.tsx` - Version history with rollback

3. **Auth**: `apps/frontend/src/utils/admin-auth.ts`

4. **API Client**: `apps/frontend/src/lib/api.ts` — `export const uiSchemaService` (top-level named export)

5. **Docs**: `docs/api/SCHEMA_API.md`, `docs/guides/ADMIN_SCHEMA_MANAGEMENT.md`

6. **Scripts**: `scripts/seed-test-data.sh`, `scripts/start-dev-services.sh`

7. **E2E Tests**: `tests/e2e/admin/schema-management.spec.ts` (61 scenarios)

### Key Type Pattern
Admin pages use a local `AdminSchema` interface (NOT `UISchema` from `@karmyq/shared`).
`UISchema` is the static code definition (no `id`/`status`). Admin pages work with
database records that add `id: string` and `status: 'draft' | 'published' | 'archived'`.

### Known Limitation (Phase 3 work)
Section/field editing in `[id]/edit` saves to local state only — not persisted via
`updateSchema`. The SectionList/FieldEditor components were scaffolded but not wired
to the save flow. Full persistence is Phase 3 work.

---

## ✅ Phase 3: Web App Completion (Weeks 5-6) - COMPLETE (2026-02-18)

### Goal
Close the gap between the Admin Schema UI and community-level configuration so
admins can actually use the schema system end-to-end without knowing secret URLs.

### What Needs to Be Built

**1. Nav entry point to Admin Schema UI**
- Add "Schema Manager" link in the community admin page
  (`apps/frontend/src/pages/communities/[id]/admin.tsx`)
- Only render it when `isAdmin()` is true (already have `admin-auth.ts`)
- Alternative: add to global nav in `AdminLayout.tsx` as a sidebar link

**2. Connect published schemas → Community Config**
- `apps/frontend/src/components/CommunityConfigEditor.tsx` currently shows
  only the 5 hardcoded `REQUEST_TYPES` constants
- Fetch published schemas from `GET /schemas` (public, no auth) on mount
- Merge with `REQUEST_TYPES` so custom schemas appear alongside built-ins
- Community founders can then enable/disable with karma multipliers as usual

**3. Wire section/field editing to backend save (carried from Phase 2)**
- `[id]/edit.tsx` `handleUpdateSection` uses `setSaving(true) + setTimeout`
  instead of calling `uiSchemaService.updateSchema()`
- Replace stub with real API call so section/field edits persist

### Success Criteria
- [x] Admin can reach `/admin/schemas` from the community admin page (no URL memorization)
- [x] Community config shows published custom schemas alongside built-in types
- [x] Founder can enable/disable custom schemas with karma multipliers
- [x] Section/field edits in the schema editor persist to the database
- [x] Full lifecycle works: create schema → publish → enable in community → usable by members

### What Was Built (Phase 3)
- `Schema Manager →` link in community admin header (creator-only)
- `CommunityConfigEditor` fetches `GET /schemas`, merges custom published types into the request type grid
- `saveSchema()` in schema editor replaces `setTimeout` stub — all mutations call `uiSchemaService.updateSchema()`
- 14 new TDD tests: `CommunityConfigEditor.test.tsx`, `SchemaManagerNav.test.tsx`, `SchemaEditorSave.test.ts`
- `docs/guides/ADMIN_SCHEMA_MANAGEMENT.md` — Section 11 added: Community Admin Integration
- `CLAUDE.md` — Pre-Merge Checklist added to development framework

### Quick Start
```bash
# Review community admin page structure
cat apps/frontend/src/pages/communities/[id]/admin.tsx

# Review community config editor (Request Types section starts ~line 265)
cat apps/frontend/src/components/CommunityConfigEditor.tsx

# Review schema editor save stub
grep -n "setSaving\|updateSchema" apps/frontend/src/pages/admin/schemas/[id]/edit.tsx
```

---

## Phase 4: Mobile Dynamic Forms (Weeks 7-8) - FUTURE

### What Needs to Be Built
```
apps/mobile/src/
  components/
    DynamicForm/
      index.tsx           ← Main component
      FieldRenderer.tsx   ← Maps UIField.type → React Native component
      SectionRenderer.tsx ← Renders a section with its fields
  hooks/
    useUISchema.ts        ← Fetch + cache schemas from backend
  utils/
    schemaCache.ts        ← Offline schema caching (AsyncStorage)
```

### Mobile Field Type Mapping
| UIField type   | React Native component             |
|----------------|-------------------------------------|
| text           | TextInput                          |
| textarea       | TextInput multiline                |
| number         | TextInput keyboardType="numeric"   |
| select         | Picker or custom modal             |
| datetime       | DateTimePicker                     |
| checkbox       | Switch                             |
| location       | Map picker                         |
| button_group   | Row of TouchableOpacity buttons    |
| chip_select    | Horizontal scroll of chips         |
| range          | Slider                             |

### Replace Hardcoded QuickCreate
`apps/mobile/src/components/QuickCreate/` has hardcoded request types.
Replace with dynamic list from `GET /schemas` (public endpoint, no auth).

### Success Criteria
- [ ] Mobile DynamicForm renders all 5 built-in request types
- [ ] Offline caching works (AsyncStorage, refresh on foreground resume)
- [ ] QuickCreate uses dynamic schema list
- [ ] All field types render appropriate native components

### Quick Start
```bash
cat apps/mobile/.claude/README.md
ls apps/mobile/src/components/
cat apps/mobile/src/components/QuickCreate/index.tsx
```

---

## Phase 5: Validation & A/B Testing - FUTURE

- Ajv JSON Schema validation in admin UI
- Validation rule editor
- A/B test dashboard
- Schema promotion workflow (custom → built-in)

---

## Key References
- **ADR**: [ADR-032](docs/adr/ADR-032-server-driven-ui-dynamic-schemas.md) — Implemented
- **Backend Admin API**: `services/request-service/src/routes/admin-schemas.ts`
- **Public Schema API**: `GET /schemas` and `GET /schemas/:type` (no auth required)
- **Frontend Admin**: `apps/frontend/src/pages/admin/schemas/`
