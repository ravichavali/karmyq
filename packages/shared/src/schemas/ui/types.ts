/**
 * UI Schema Types — Server-Driven UI for Polymorphic Request Forms
 *
 * These types define the schema format served by the backend to render
 * request creation forms dynamically. The frontend's DynamicForm component
 * interprets these schemas to render the appropriate fields.
 *
 * Validation remains server-side via Zod schemas — UI schemas only
 * describe presentation (layout, components, labels, help text).
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'datetime'
  | 'checkbox'
  | 'location'
  | 'button_group'
  | 'chip_select'
  | 'range'
  | 'object';

export interface FieldOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface UIField {
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  width?: 'full' | 'half' | 'third';
  // For select, button_group, chip_select
  options?: FieldOption[];
  // For number, range
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  // For range: labels for min/max fields
  minLabel?: string;
  maxLabel?: string;
  // For object: nested sub-fields
  fields?: UIField[];
}

export interface UISection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  fields: UIField[];
}

export interface UISummaryConfig {
  fields: string[];
  labels?: Record<string, string>;
}

export interface UISchema {
  type: string;
  version: number;
  label: string;
  icon: string;
  color: string;
  description: string;
  sections: UISection[];
  summary?: UISummaryConfig;
}
