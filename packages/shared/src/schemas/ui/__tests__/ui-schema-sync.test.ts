/**
 * UI Schema Sync Test
 *
 * Verifies that UI schemas stay in sync with their corresponding Zod schemas.
 * Every required field in the Zod schema should have a corresponding UI field,
 * and every required UI field should exist in the Zod schema.
 */

import { z } from 'zod';
import { getAllUISchemas, getUISchema } from '../index';
import { UISchema, UIField } from '../types';

// Import Zod payload schemas
import { RidePayloadSchema } from '../../requests/ride';
import { ServicePayloadSchema } from '../../requests/service';
import { EventPayloadSchema } from '../../requests/event';
import { BorrowPayloadSchema } from '../../requests/borrow';

const zodSchemas: Record<string, z.ZodTypeAny> = {
  ride: RidePayloadSchema,
  service: ServicePayloadSchema,
  event: EventPayloadSchema,
  borrow: BorrowPayloadSchema,
};

/**
 * Extract all field keys from a UI schema (flattened dot-paths)
 */
function getUIFieldKeys(schema: UISchema): Set<string> {
  const keys = new Set<string>();

  function collectKeys(fields: UIField[]) {
    for (const field of fields) {
      keys.add(field.key);
      if (field.fields) {
        collectKeys(field.fields);
      }
    }
  }

  for (const section of schema.sections) {
    collectKeys(section.fields);
  }

  return keys;
}

/**
 * Extract required field keys from a UI schema
 */
function getRequiredUIFieldKeys(schema: UISchema): Set<string> {
  const keys = new Set<string>();

  function collectKeys(fields: UIField[]) {
    for (const field of fields) {
      if (field.required) {
        keys.add(field.key);
      }
      if (field.fields) {
        collectKeys(field.fields);
      }
    }
  }

  for (const section of schema.sections) {
    collectKeys(section.fields);
  }

  return keys;
}

/**
 * Extract top-level required keys from a Zod object schema
 */
function getZodRequiredKeys(schema: z.ZodTypeAny): Set<string> {
  const keys = new Set<string>();

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      // A field is required if it's NOT optional and NOT has a default
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        keys.add(key);
      }
    }
  }

  return keys;
}

/**
 * Extract all top-level keys from a Zod object schema
 */
function getZodAllKeys(schema: z.ZodTypeAny): Set<string> {
  const keys = new Set<string>();

  if (schema instanceof z.ZodObject) {
    for (const key of Object.keys(schema.shape)) {
      keys.add(key);
    }
  }

  return keys;
}

describe('UI Schema Sync', () => {
  test('all 5 request types have UI schemas', () => {
    const schemas = getAllUISchemas();
    const types = schemas.map((s) => s.type).sort();
    expect(types).toEqual(['borrow', 'event', 'generic', 'ride', 'service']);
  });

  test('all schemas have valid structure', () => {
    const schemas = getAllUISchemas();
    for (const schema of schemas) {
      expect(schema.type).toBeTruthy();
      expect(schema.version).toBeGreaterThan(0);
      expect(schema.label).toBeTruthy();
      expect(schema.icon).toBeTruthy();
      expect(schema.color).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(Array.isArray(schema.sections)).toBe(true);
    }
  });

  test('generic schema has no payload fields', () => {
    const schema = getUISchema('generic');
    expect(schema).toBeDefined();
    expect(schema!.sections).toHaveLength(0);
  });

  // For each type with a Zod schema, verify required fields have UI fields
  for (const [type, zodSchema] of Object.entries(zodSchemas)) {
    test(`${type}: every Zod required field has a UI field`, () => {
      const uiSchema = getUISchema(type);
      expect(uiSchema).toBeDefined();

      const zodRequired = getZodRequiredKeys(zodSchema);
      const uiFieldKeys = getUIFieldKeys(uiSchema!);

      // For each required Zod field, check it has a UI field
      // (UI keys use dot-paths, so "origin" matches "origin")
      for (const zodKey of zodRequired) {
        const hasUIField = [...uiFieldKeys].some(
          (uiKey) => uiKey === zodKey || uiKey.startsWith(`${zodKey}.`)
        );
        expect(hasUIField).toBe(true);
      }
    });

    test(`${type}: every required UI field maps to a Zod field`, () => {
      const uiSchema = getUISchema(type);
      expect(uiSchema).toBeDefined();

      const requiredUIKeys = getRequiredUIFieldKeys(uiSchema!);
      const zodAllKeys = getZodAllKeys(zodSchema);

      for (const uiKey of requiredUIKeys) {
        // Get the top-level key (before the first dot)
        const topLevelKey = uiKey.split('.')[0];
        expect(zodAllKeys.has(topLevelKey)).toBe(true);
      }
    });
  }

  test('all field keys are unique within each schema', () => {
    const schemas = getAllUISchemas();
    for (const schema of schemas) {
      const keys = getUIFieldKeys(schema);
      const keyArray = [...keys];
      const uniqueKeys = new Set(keyArray);
      expect(keyArray.length).toBe(uniqueKeys.size);
    }
  });

  test('all schemas have version >= 1', () => {
    const schemas = getAllUISchemas();
    for (const schema of schemas) {
      expect(schema.version).toBeGreaterThanOrEqual(1);
    }
  });
});
