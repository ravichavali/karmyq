# Admin Schema API Reference

**Version:** v1.0
**Last Updated:** 2026-02-17

---

## Overview

The Admin Schema API provides endpoints for managing Server-Driven UI request type schemas. This enables non-technical admins to create and customize request types without code deployments.

**Base URL:** `http://localhost:3003` (or production URL)

**Authentication:** Requires `super_admin` or `admin` role

---

## Public Schema API (Existing - Modified for Server-Driven UI)

### Get All Schemas

List all available schemas with optional filtering.

**Endpoint:** `GET /schemas`

**Query Parameters:**
- `status` (optional): Filter by schema status
  - `type` (optional): Filter by request type
- `limit` (optional): Pagination limit
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "schemas": [
      {
        "id": "uuid",
        "type": "generic",
        "label": "Generic Request",
        "icon": "📝",
        "color": "#10b981",
        "description": "Standard request type",
        "status": "published",
        "version": 1,
        "sections": [...]
      }
    ],
    "total": 10,
    "limit": 20,
    "offset": 0
  }
}
```

### Get Schema by Type

Get a specific schema including all versions.

**Endpoint:** `GET /schemas/{type}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "generic",
    "label": "Generic Request",
    "icon": "📝",
    "color": "#10b981",
    "description": "Standard request type",
    "status": "published",
    "version": 1,
    "sections": [...],
    "current_version": 1,
    "versions": [...]
  }
}
```

---

## Admin Schema API (New - Phase 2)

All endpoints require `super_admin` or `admin` role authentication.

### Get All Schemas

List all schemas (draft, published, archived) with pagination and filtering.

**Endpoint:** `GET /admin/schemas`

**Query Parameters:**
- `status` (optional): Filter by schema status
- `type` (optional): Filter by request type
- `limit` (optional): Pagination limit (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "schemas": [
      {
        "id": "uuid",
        "type": "dogwalking",
        "label": "Dog Walking Request",
        "icon": "🐕",
        "color": "#ff5722",
        "description": "Help with walking your dog",
        "status": "draft",
        "version": 1,
        "sections": [...],
        "created_at": "2026-02-15T12:34:56Z",
        "updated_at": "2026-02-15T13:21:45Z",
        "created_by": "admin_user_id",
        "updated_by": "admin_user_id"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3003/admin/schemas?status=draft
```

### Get Schema by ID

Get a specific schema including version history.

**Endpoint:** `GET /admin/schemas/{id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dogwalking",
    "label": "Dog Walking Request",
    "icon": "🐕",
    "color": "#ff5722",
    "description": "Help with walking your dog",
    "status": "draft",
    "version": 1,
    "sections": [...],
    "current_version": 1,
    "versions": [
      {
        "id": "uuid",
        "version": 1,
        "schema_snapshot": {...},
        "created_at": "2026-02-15T12:34:56Z",
        "changed_by": "admin_user_id",
        "change_description": "Initial version"
      },
      {
        "id": "uuid",
        "version": 2,
        "schema_snapshot": {...},
        "created_at": "2026-02-15T13:00:12Z",
        "changed_by": "admin_user_id",
        "change_description": "Updated dog breed options"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3003/admin/schemas/dogwalking-id
```

### Create New Schema

Create a new custom request type schema with sections and fields.

**Endpoint:** `POST /admin/schemas`

**Request Body:**
```json
{
  "type": "dogwalking",
  "label": "Dog Walking Request",
  "icon": "🐕",
  "color": "#ff5722",
  "description": "Help with walking your dog",
  "sections": [
    {
      "id": "uuid",
      "title": "Dog Details",
      "fields": [
        {
          "id": "uuid",
          "section_id": "section-uuid",
          "type": "text",
          "label": "Dog Breed",
          "required": true
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schema_id": "uuid",
    "version": 1,
    "id": "uuid"
    "type": "dogwalking",
    "label": "Dog Walking Request",
    "icon": "🐕",
    "color": "#ff5722",
    "description": "Help with walking your dog",
    "sections": [...],
    "status": "draft"
  }
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3003/admin/schemas \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
      "type": "dogwalking",
      "label": "Dog Walking Request",
      "icon": "🐕",
      "color": "#ff5722",
      "description": "Help with walking your dog",
      "sections": [...]
    }'
```

### Update Schema

Update an existing schema (increments version automatically).

**Endpoint:** `PUT /admin/schemas/{type}`

**Request Body:**
```json
{
  "label": "Dog Walking (Updated)",
  "sections": [...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schema_id": "uuid",
    "type": "dogwalking",
    "version": 2,
    "updated_at": "2026-02-15T13:30:12Z",
    "updated_by": "admin_user_id",
    "change_description": "Updated dog breed options"
  }
}
```

### Publish Schema

Publish a draft schema to make it live and available to all users.

**Endpoint:** `POST /admin/schemas/{type}/publish`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dogwalking",
    "status": "published",
    "version": 2,
    "published_at": "2026-02-15T13:45:00Z",
    "published_by": "admin_user_id"
  }
}
```

### Archive Schema

Hide a published schema from users (can be restored later).

**Endpoint:** `POST /admin/schemas/{type}/archive`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dogwalking",
    "status": "archived",
    "archived_at": "2026-02-15T13:45:00Z",
    "archived_by": "admin_user_id"
  }
}
```

### Get Version History

Get all versions for a schema with rollback capability.

**Endpoint:** `GET /admin/schemas/{id}/versions`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dogwalking",
    "current_version": 2,
    "versions": [
      {
        "id": "uuid",
        "version": 1,
        "schema_snapshot": {...},
        "created_at": "2026-02-15T12:34:56Z",
        "changed_by": "admin_user_id",
        "change_description": "Initial version"
      },
      {
        "id": "uuid",
        "version": 2,
        "schema_snapshot": {...},
        "created_at": "2026-02-15T13:00:12Z",
        "changed_by": "admin_user_id",
        "change_description": "Updated dog breed options"
      }
    ]
  }
}
```

### Rollback to Version

Rollback a schema to a previous version.

**Endpoint:** `POST /admin/schemas/{id}/rollback/{version}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "dogwalking",
    "current_version": 2,
    "new_version": 1,
    "created_at": "2026-02-15T13:45:00Z",
    "changed_by": "admin_user_id",
    "change_description": "Rollback to v1"
  }
}
```

### Create A/B Test Variant

Create an A/B testing variant for a schema.

**Endpoint:** `POST /admin/schemas/{id}/variants`

**Request Body:**
```json
{
  "variant_name": "blue_form",
  "rollout_percentage": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "variant_name": "blue_form",
    "rollout_percentage": 50
  }
}
```

### Validate Schema

Test a schema payload against its validation rules before publishing.

**Endpoint:** `POST /schemas/{type}/validate`

**Request Body:**
```json
{
  "dog_breed": "Labrador",
  "duration_hours": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": []
  }
}
```

---

## Response Format

All admin schema API responses follow this standard format:

```json
{
  "success": boolean,
  "data": object,
  "message": string (optional, on success/error)
}
```

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE",
  "data": null
}
```

---

## Authentication

Admin API endpoints use the same JWT-based authentication as other services:

**Headers:**
```http
Authorization: Bearer <token>
```

**Role Requirements:**
- `super_admin`: Full access to all admin features
- `admin`: Create and manage own schemas only
- View access to read schemas and version history

**Checking Your Role:**

You can check your current role by:

1. Log in to Karmyq
2. Go to your profile page
3. Look at your role in the profile

Or programmatically:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3003/api/me/profile
```

---

## Field Types

### Supported Field Types

| Type | Input Component | Properties |
|------|---------------|-----------|-------------|
| **text** | TextField | label, required, minLength, maxLength, pattern | Standard text input |
| **number** | NumberField | label, required, min, max, step | Numeric input with constraints |
| **select** | SelectField | label, required, options | Dropdown selection |
| **button-group** | ButtonGroupField | label, required, options | Radio button grid |
| **checkbox** | CheckboxField | label, required | Toggle switch |
| **range** | RangeField | label, required, min, max, step | Slider input |
| **location** | LocationField | label, required, placeholder | Location picker |
| **datetime** | DateTimeField | label, required, placeholder | Date/time picker |
| **chip-select** | ChipSelectField | label, required, options | Multi-select with chips |

---

## Sections

A section groups related fields for organization:

**Example:**
```json
{
  "title": "Contact Info",
  "fields": [
    {
      "id": "field-1",
      "type": "text",
      "label": "Name",
      "required": true
    },
    {
      "id": "field-2",
      "type": "email",
      "label": "Email",
      "required": true
    },
    {
      "id": "field-3",
      "type": "phone",
      "label": "Phone",
      "required": false
    }
  ]
}
```

---

## Validation Rules

### Built-in Type Validation

Built-in types (generic, ride, service, event, borrow) use **Zod** schemas for validation. Custom types use **JSON Schema**.

### Custom Type Validation

Custom types define validation rules in the `validation_schema` column of the `requests.ui_schemas` table.

**Validation Rule Schema:**
```json
{
  "rule_id": "uuid",
  "schema_type": "dogwalking",
  "rule_name": "dog_breed_required",
  "rule_schema": {
    "type": "object",
    "required": ["dog_breed"]
  }
}
```

---

## Status Codes

| Code | Description |
|------|-------------|-----------|
| `draft` | Schema is being edited, not yet published |
| `published` | Schema is live and available to users |
| `archived` | Schema is hidden from users |

---

## Best Practices

### For Creating Effective Schemas

1. **Start Simple** - Begin with basic sections (title, description), add fields as needed
2. **Use Descriptive Labels** - Clear field names help users understand what information to provide
3. **Test Thoroughly** - Use the "Validate" button before publishing
4. **Version from Start** - Begin with version 1, track changes from the beginning
5. **Use Validation** - Add validation rules to prevent invalid submissions
6. **Consider User Experience** - Think about what information users need and how they'll interact with the form

### For Editing Schemas

1. **Save Frequently** - Save often to avoid losing work
2. **Use Draft Status** - Keep schemas in draft while editing, publish when ready
3. **Document Changes** - Use the "change_description" field to explain what changed
4. **Test Incrementally** - Save and test each section independently

### For Publishing

1. **Check Dependencies** - Ensure all required fields have values
2. **Review Validation** - Fix any validation errors before publishing
3. **Consider Impact** - Published schemas affect all users, test thoroughly

---

## Quick Start

### 1. Create Your First Custom Schema

Navigate to `/admin/schemas/new`

1. Choose "Custom Type" in type selector
2. Enter details:
   - **Label**: "Tutoring Request"
   - **Icon**: "👨"
   - **Color**: Pick a theme color
   - **Description**: "Help students get matched with tutors"

3. Click "+ Add Section"
4. Add "Student Name" text field
5. Click "Create Schema" button

### 2. Edit Existing Schema

Navigate to `/admin/schemas/{id}/edit`

Use the tabs to modify:
- **Sections**: Define sections
- **Fields**: Add/edit/remove fields
- **Preview**: Test how form looks

---

## Testing Your Admin UI

After deploying to the demo server, test the admin UI:

1. **Navigate** to `https://karmyq.com/admin/schemas`
2. **Create Test Schema** - Use the create workflow
3. **Edit Schema** - Test section and field management
4. **Publish Schema** - Test publish workflow
5. **Version History** - Test rollback
6. **Validation** - Test validation rules

---

## Support

For questions or issues, refer to:
- [Admin UI Guide](docs/guides/ADMIN_SCHEMA_MANAGEMENT.md) - Comprehensive user guide
- [API Reference](docs/api/SCHEMA_API.md) - Complete API reference

---

**Version:** v1.0
**Last Updated:** 2026-02-17
