/**
 * UI Schema Registry — Server-Driven UI
 *
 * Central registry for all request type UI schemas. The request-service
 * serves these schemas via GET /schemas/:type, and the frontend's
 * DynamicForm component renders forms from them.
 */

export * from './types';

import { UISchema } from './types';
import { genericUISchema } from './generic';
import { rideUISchema } from './ride';
import { serviceUISchema } from './service';
import { eventUISchema } from './event';
import { borrowUISchema } from './borrow';

export { genericUISchema } from './generic';
export { rideUISchema } from './ride';
export { serviceUISchema } from './service';
export { eventUISchema } from './event';
export { borrowUISchema } from './borrow';

const schemaRegistry: Record<string, UISchema> = {
  generic: genericUISchema,
  ride: rideUISchema,
  service: serviceUISchema,
  event: eventUISchema,
  borrow: borrowUISchema,
};

/**
 * Get the UI schema for a request type.
 * Returns undefined if the type is not found.
 */
export function getUISchema(type: string): UISchema | undefined {
  return schemaRegistry[type];
}

/**
 * Get all available UI schemas.
 */
export function getAllUISchemas(): UISchema[] {
  return Object.values(schemaRegistry);
}

/**
 * Get a summary list of all available schemas (for listing endpoint).
 */
export function getUISchemaSummaries(): Array<{
  type: string;
  version: number;
  label: string;
  icon: string;
  color: string;
  description: string;
}> {
  return getAllUISchemas().map((s) => ({
    type: s.type,
    version: s.version,
    label: s.label,
    icon: s.icon,
    color: s.color,
    description: s.description,
  }));
}
