/**
 * Schema Endpoint Unit Tests
 *
 * Tests the /schemas API endpoint that serves UI schemas
 * for the Server-Driven UI (DynamicForm) system.
 */

import {
  getUISchema,
  getAllUISchemas,
  getUISchemaSummaries,
} from '@karmyq/shared/schemas/ui';
import type { UISchema } from '@karmyq/shared/schemas/ui';

describe('Schema Registry', () => {
  test('getUISchema returns schema for valid types', () => {
    const types = ['generic', 'ride', 'service', 'event', 'borrow'];
    for (const type of types) {
      const schema = getUISchema(type);
      expect(schema).toBeDefined();
      expect(schema!.type).toBe(type);
    }
  });

  test('getUISchema returns undefined for unknown types', () => {
    expect(getUISchema('nonexistent')).toBeUndefined();
    expect(getUISchema('')).toBeUndefined();
  });

  test('getAllUISchemas returns all 5 schemas', () => {
    const schemas = getAllUISchemas();
    expect(schemas).toHaveLength(5);
    const types = schemas.map((s) => s.type).sort();
    expect(types).toEqual(['borrow', 'event', 'generic', 'ride', 'service']);
  });

  test('getUISchemaSummaries returns summaries with correct fields', () => {
    const summaries = getUISchemaSummaries();
    expect(summaries).toHaveLength(5);

    for (const summary of summaries) {
      expect(summary.type).toBeTruthy();
      expect(summary.version).toBeGreaterThanOrEqual(1);
      expect(summary.label).toBeTruthy();
      expect(summary.icon).toBeTruthy();
      expect(summary.color).toBeTruthy();
      expect(summary.description).toBeTruthy();
      // Summaries should NOT include sections (they're lightweight)
      expect((summary as any).sections).toBeUndefined();
    }
  });
});

describe('Ride Schema', () => {
  let schema: UISchema;

  beforeAll(() => {
    schema = getUISchema('ride')!;
  });

  test('has trip and preferences sections', () => {
    const sectionIds = schema.sections.map((s) => s.id);
    expect(sectionIds).toContain('trip');
    expect(sectionIds).toContain('preferences');
  });

  test('trip section has required fields', () => {
    const tripSection = schema.sections.find((s) => s.id === 'trip')!;
    const fieldKeys = tripSection.fields.map((f) => f.key);
    expect(fieldKeys).toContain('origin');
    expect(fieldKeys).toContain('destination');
    expect(fieldKeys).toContain('seats_needed');
    expect(fieldKeys).toContain('departure_time');
  });

  test('origin and destination use location type', () => {
    const tripSection = schema.sections.find((s) => s.id === 'trip')!;
    const originField = tripSection.fields.find((f) => f.key === 'origin')!;
    const destField = tripSection.fields.find((f) => f.key === 'destination')!;
    expect(originField.type).toBe('location');
    expect(destField.type).toBe('location');
    expect(originField.required).toBe(true);
    expect(destField.required).toBe(true);
  });

  test('preferences fields are optional checkboxes', () => {
    const prefSection = schema.sections.find((s) => s.id === 'preferences')!;
    for (const field of prefSection.fields) {
      expect(field.type).toBe('checkbox');
      expect(field.required).toBe(false);
    }
  });

  test('has summary config', () => {
    expect(schema.summary).toBeDefined();
    expect(schema.summary!.fields).toContain('origin');
    expect(schema.summary!.fields).toContain('destination');
  });
});

describe('Service Schema', () => {
  let schema: UISchema;

  beforeAll(() => {
    schema = getUISchema('service')!;
  });

  test('has service_details, budget, and schedule sections', () => {
    const sectionIds = schema.sections.map((s) => s.id);
    expect(sectionIds).toContain('service_details');
    expect(sectionIds).toContain('budget');
    expect(sectionIds).toContain('schedule');
  });

  test('service_category uses button_group type', () => {
    const detailSection = schema.sections.find((s) => s.id === 'service_details')!;
    const categoryField = detailSection.fields.find((f) => f.key === 'service_category')!;
    expect(categoryField.type).toBe('button_group');
    expect(categoryField.required).toBe(true);
    expect(categoryField.options!.length).toBe(15);
  });

  test('budget uses range type', () => {
    const budgetSection = schema.sections.find((s) => s.id === 'budget')!;
    const rangeField = budgetSection.fields.find((f) => f.key === 'budget_range')!;
    expect(rangeField.type).toBe('range');
  });

  test('schedule days use chip_select type', () => {
    const scheduleSection = schema.sections.find((s) => s.id === 'schedule')!;
    const daysField = scheduleSection.fields.find((f) => f.key === 'preferred_schedule.days')!;
    expect(daysField.type).toBe('chip_select');
    expect(daysField.options!.length).toBe(7);
  });
});

describe('Generic Schema', () => {
  test('has no sections (no type-specific fields)', () => {
    const schema = getUISchema('generic')!;
    expect(schema.sections).toHaveLength(0);
  });
});
