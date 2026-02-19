# Admin UI - Server-Driven UI Schema Management

**Last Updated:** 2026-02-17

**Purpose:** Comprehensive guide for non-technical admins to create, edit, publish, and archive request type schemas using the Server-Driven UI.

**Target Audience:** Community admins (super_admin, admin role) who need to manage request type schemas but are not developers.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Understanding Schemas](#understanding-schemas)
4. [Creating Schemas](#creating-schemas)
5. [Editing Schemas](#editing-schemas)
6. [Publishing & Archiving](#publishing-archiving)
7. [Version Management](#version-management)
8. [Advanced Features](#advanced-features)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)
11. [Community Admin Integration](#community-admin-integration-phase-3)

---

## 1. Overview

The Server-Driven UI enables creating and managing custom request types without code deployments. As a community admin, you can now:

- **Create new request types** like "Dog Walking" or "Tutoring" with custom forms
- **Edit existing schema layouts** - Reorder sections, add/remove fields
- **Publish schemas** - Make them available to all users
- **Archive unused schemas** - Hide from public view
- **Version history** - Track all changes and rollback if needed

### Who Can Use Admin UI

**Requirements:**
- User role: `super_admin` or `admin`
- No technical background needed
- Basic understanding of form schemas

### Key Features

- **Form Builder** - Visual editor with sections and fields
- **Live Preview** - See how form renders in production
- **Version History** - Track all changes with rollback
- **Status Management** - Draft, Published, Archived states
- **Validation** - Test schemas before publishing

### Accessing Admin UI

Navigate to: `https://karmyq.com/admin/schemas`

---

## 2. Getting Started

### Authentication

Access to admin pages requires **admin role**. Verify your user has the appropriate permissions:

1. Log in to Karmyq
2. Go to your profile
3. Check if you have admin role (super_admin or admin)

### Navigation

- **Schema List**: `/admin/schemas` - View all schemas
- **Create New**: `/admin/schemas/new` - Start creating new schema
- **Edit Schema**: `/admin/schemas/{id}/edit` - Edit existing schema
- **View Versions**: `/admin/schemas/{id}/versions` - View version history

---

## 3. Understanding Schemas

### What is a Schema?

A schema defines the form structure for a specific request type. It includes:

**Components (Sections):**
- Title and description
- Fields (form inputs)
- Layout and order

**Properties:**
- `type`: Unique identifier (e.g., "ride", "service", "event", "borrow")
- `label`: Display name (e.g., "Dog Walking")
- `icon`: Emoji or icon character
- `color`: Theme color (e.g., "#ff5722")
- `description`: User-facing description
- `status`: draft | published | archived
- `version`: Auto-incremented on changes

### Schema Status

- **Draft**: Being edited, not yet published
- **Published**: Available to all users in request forms
- **Archived**: Hidden from users, can be restored

### Schema Types

**Built-in Types:**
- Generic, Ride, Service, Event, Borrow
- Use Zod validation (type-safe)
- Cannot be edited via admin UI (requires code changes)

**Custom Types:**
- Created by admins
- Use JSON Schema validation
- Fully editable via admin UI
- Can be promoted to "built-in" type

### Sections and Fields

**Field Types:**
- Text, Number, Select, Button Group, Checkbox, Range, Location, DateTime, Chip Select

**Validation Rules:**
- `required`: Field must have a value
- Pattern/Regex: Text pattern matching
- Min/Max values: Numeric range constraints
- Custom validation: JSON Schema for complex rules

---

## 4. Creating Schemas

### Create New Schema Flow

1. **Navigate** to `/admin/schemas/new`
2. **Choose Type**:
   - **Built-in Type**: Select from existing (generic, ride, service, event, borrow)
   - **Custom Type**: Enter new type name (e.g., "tutoring")

3. **Basic Info:**
   - **Label**: Display name for the request type
   - **Icon**: Emoji or character (e.g., 📚)
   - **Color**: Theme color from palette
   - **Description**: Explain what users should provide

4. **Add Sections:**
   - Start with "Basic Info" section
   - Add fields as needed (title, type-specific fields)

5. **Save Schema:**
   - Click "Create Schema" button

### Tips for Great Schemas

- **Keep it simple**: Start with essential sections, add more later
- **Use descriptive labels**: Clear field names (e.g., "Dog Breed" vs "Dog Info")
- **Plan ahead**: Think about what information you'll need before building
- **Test validation**: Use "Validate" button to test schema before publishing

---

## 5. Editing Schemas

### Opening the Editor

1. **Navigate** to `/admin/schemas/{id}/edit`
2. **Four Tabs**:
   - **Sections Tab**: Define sections and their order
   - **Fields Tab**: Manage all fields in selected section
   - **Preview Tab**: Live preview of the form
   - **Versions Tab**: Version history and rollback

### Section Management

**Actions:**
- **Add Section**: Click "+ Add Section" button
- **Edit Section**: Click on section title or description
- **Remove Section**: Click "Remove" button (requires confirmation)
- **Reorder Sections**: Drag sections up/down using drag handles (native HTML5 Drag and Drop on desktop)

### Field Management

**Actions:**
- **Add Field**: Click "+ Add Field" button
- **Edit Field**: Click on field to open editor
- **Remove Field**: Click "Remove" button (requires confirmation)
- **Reorder Fields**: Drag fields up/down within section

### Tab Navigation

Use the tab buttons at the top of the editor to switch between:
- **Sections** (default) - Define form structure
- **Fields** - Edit individual fields
- **Preview** - See live form rendering
- **Versions** - View history

---

## 6. Publishing & Archiving

### Publishing a Schema

1. Click the "Publish" button in the editor
2. Review the publish confirmation dialog
3. Confirm: Schema will become live and available to all users
4. Cannot be undone (only archived)

### Archiving a Schema

1. Click the "Archive" button in the editor
2. Review the archive confirmation dialog
3. Confirm: Schema will be hidden from users
4. Can be restored by rolling back to a previous version or creating as draft

### What Happens After Publishing

- **Status Change**: Schema status changes from `draft` → `published`
- **Version Increment**: Auto-increments to `v2`, `v3`, etc.
- **Frontend Update**: All users immediately see the new schema in request forms
- **Caching**: In-memory and Redis caches are updated

### Rollback from Archived

Archived schemas can be restored by rolling back to a previous version:

1. In the **Versions** tab, click "Rollback" on the target version
2. The schema status changes back to `published` with a new version number
3. All new requests will use the rolled-back version

### Warnings

⚠️ **Archived schemas cannot be edited**
- Only version history and rollback are available
- To edit: Rollback to a version, then make changes and publish again

⚠️ **Published schemas cannot be rolled back**
- Rolling back would overwrite the current live version
- To revert changes: Create a new version as draft

---

## 7. Version Management

### Understanding Versions

Every time you save a schema, a new version is created automatically:

- **Version Number**: Auto-incremented (1, 2, 3, ...)
- **Schema Snapshot**: Complete copy of the schema at that version
- **Changed By**: User who made the change
- **Change Description**: Optional text explaining what changed
- **Created At**: Timestamp of version creation

### Viewing Version History

1. Navigate to `/admin/schemas/{id}/versions`
2. Click on any version in the timeline to view details:
   - **Before**: Schema snapshot (form structure)
   - **After**: Current schema snapshot (what it changed)
   - **Change Summary**: Comparison of what changed

### Rollback to Previous Version

1. In the **Versions** tab, click "Rollback" on the target version
2. System creates a new version from that snapshot
3. Schema status becomes `published` with the rolled-back version number

### Comparison View

The Versions tab shows a side-by-side diff of before and after states:
- Left side: Version N
- Right side: Version N+1 (rolled back)

### What Happens After Rollback

- **New Version Created**: `v(N+1)` with schema snapshot
- **Status Change**: Published → Draft (with new content from rolled-back version)
- **Live Version Updated**: Users see version `N+1` instead of `N`

---

## 8. Advanced Features

### Live Preview

The **Preview** tab in the editor shows a live preview of how your schema renders in production using the `DynamicForm` component.

**Benefits:**
- See exactly what users will see
- Test interactions in real-time
- Validate field behavior (placeholders, validation)

### Drag and Drop

**Desktop**: Full drag-and-drop support for reordering sections and fields
**Mobile**: Coming soon - Tap and drag on mobile devices

### Validation

Before publishing a schema, test it using the "Validate" button:

1. **Test Payload**: Enter sample data to test validation rules
2. Review validation errors
3. Fix any issues
4. Publish when satisfied

---

## 9. API Reference

### Schema API Endpoints

All admin schema endpoints require `super_admin` or `admin` role:

#### List Schemas
```bash
GET /admin/schemas?status=draft
GET /admin/schemas?status=published
GET /admin/schemas?status=archived
GET /admin/schemas?type=ride
GET /admin/schemas?limit=20&offset=0
```

#### Create Schema
```bash
POST /admin/schemas
Content-Type: application/json
{
  "type": "dogwalking",
  "label": "Dog Walking Request",
  "icon": "🐕",
  "color": "#ff5722",
  "description": "Help with walking your dog",
  "sections": [...]
}
```

#### Get Schema
```bash
GET /admin/schemas/ride
```

#### Update Schema
```bash
PUT /admin/schemas/ride
Content-Type: application/json
{
  "label": "Dog Walking (Updated)",
  "sections": [...]
}
```

#### Publish Schema
```bash
POST /admin/schemas/ride/publish
```

#### Archive Schema
```bash
POST /admin/schemas/ride/archive
```

#### Version History
```bash
GET /admin/schemas/ride/versions
```

#### Rollback
```bash
POST /admin/schemas/ride/rollback/2
```

### Validation
```bash
POST /schemas/ride/validate
Content-Type: application/json
{
  "dog_breed": "Labrador",
  "duration_hours": 2
}
```

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": {...}
}
```

---

## 10. Troubleshooting

### Common Issues

**Schema Not Saving:**
1. Check browser console for errors
2. Verify you're logged in
3. Try refreshing the page

**Version Rollback Not Working:**
1. Ensure the target version exists
2. Rollback to an earlier version, not the latest
3. Published schemas cannot be rolled back (warning shown in UI)

**Publish Fails:**
1. Check schema validation (see below)
2. Ensure all required fields have values
3. Verify admin role (super_admin required)
4. Check for validation errors

### Validation Errors

**Common validation errors:**
- `missing_required_field`: A required field is missing a value
- `invalid_type`: Invalid value type for a field
- `pattern_mismatch`: Value doesn't match required pattern
- `custom_validation_error`: JSON Schema validation failed

---

## 11. Glossary

- **Schema**: Complete form definition for a request type
- **Section**: Logical grouping of related fields within a schema
- **Field**: Individual form input with specific type and validation
- **Version**: Snapshot of a schema at a specific point in time
- **Draft**: Schema state when being edited, not yet available to users
- **Published**: Schema state when available to all users
- **Archived**: Schema state when hidden from users but can be restored
- **Validation**: Testing a schema payload against its validation rules

- **Published Schema**: Schema that users can see in request forms
- **Live Version**: Current active version of a published schema

---

## 12. Appendices

**A. Admin UI Pages**
- [Schema List Page](apps/frontend/src/pages/admin/schemas/index.tsx)
- [New Schema Page](apps/frontend/src/pages/admin/schemas/new.tsx)
- [Schema Editor Page](apps/frontend/src/pages/admin/schemas/[id]/edit.tsx)
- [Version History Page](apps/frontend/src/pages/admin/schemas/[id]/versions.tsx)

**B. Admin Components**
- [AdminLayout](apps/frontend/src/components/admin/AdminLayout.tsx)
- [SectionList](apps/frontend/src/components/admin/SectionList.tsx)
- [SectionHeader](apps/frontend/src/components/admin/SectionHeader.tsx)
- [SectionEditor](apps/frontend/src/components/admin/SectionEditor.tsx)
- [FieldEditor](apps/frontend/src/components/admin/FieldEditor.tsx)
- [FieldList](apps/frontend/src/components/admin/FieldList.tsx)
- [LivePreview](apps/frontend/src/components/admin/LivePreview.tsx)
- [PublishDialog](apps/frontend/src/components/admin/PublishDialog.tsx)
- [ArchiveDialog](apps/frontend/src/components/admin/ArchiveDialog.tsx)

**C. API Client**
- [api.ts](apps/frontend/src/lib/api.ts) - Updated with uiSchemaService methods

**D. Documentation**
- [ADMIN_SCHEMA_MANAGEMENT.md](docs/guides/ADMIN_SCHEMA_MANAGEMENT.md) (NEW)
- [SCHEMA_API.md](docs/api/SCHEMA_API.md) (UPDATED)

---

---

## 11. Community Admin Integration (Phase 3)

After publishing a schema, community founders must enable it in their community configuration before members can use it.

### End-to-End Workflow

```
Create Schema  →  Publish Schema  →  Enable in Community  →  Members Can Use It
(Schema Manager)   (Schema Manager)   (Community Admin)       (Request Creation)
```

### Step 1 — Navigate from Community Admin Page

Community founders see a **"Schema Manager →"** link in the top-right corner of their community admin panel (`/communities/{id}/admin`). This link is only visible to the community creator — regular admins and moderators do not see it.

Click **Schema Manager →** to open `/admin/schemas`.

### Step 2 — Publish Your Schema

In the Schema Manager, ensure your schema has **Published** status. Drafts and archived schemas do not appear in community configuration. If needed, open the schema editor and click **Publish**.

### Step 3 — Enable the Schema in Community Configuration

1. Return to your community admin page (`/communities/{id}/admin`)
2. Click the **Configuration** tab
3. Expand the **Request Types** section
4. Your published custom schema now appears in the grid alongside the 5 built-in types (General Help, Ride Share, Service Request, Event, Borrow)
5. Click the card to **enable** it (blue border = enabled, grey = disabled)
6. Adjust the **Karma Multiplier** slider (0.5×–2.0×) to set how much karma this request type awards relative to others
7. Click **Save Configuration**

> Only the community founder can modify the Configuration tab. Other admins can view it read-only.

### Step 4 — Members Create Requests

Once enabled, the custom schema type appears in the request creation form for all community members. The dynamic form renders the sections and fields you defined in the Schema Manager.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Schema not appearing in Configuration tab | Schema is Draft or Archived | Publish the schema in Schema Manager |
| Schema Manager link not visible | You are not the community creator | Log in as the founder account |
| Custom schema missing after save | Fetch error on config load | Refresh the page; check request-service is running |
| Karma multiplier not saving | Config validation error | Ensure trust weights sum to 1.0 (see error banner) |

---

**Version:** v1.1 (Phase 3 — Community Integration)
**Last Updated:** 2026-02-18
