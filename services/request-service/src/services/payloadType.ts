/**
 * Sprint 86 / ADR-067 — Canonical `category → payload_type` vocabulary adapter.
 *
 * THE single place `category` is translated to the renderer's fine payload subtype. Do NOT
 * scatter inline category maps in routes/components — route every translation through here.
 *
 * Why this exists: `request_type` (the 5-value `request_type_enum` — generic|ride|borrow|
 * service|event) is the coarse FILTER dimension. The card's `RequestPayloadRenderer` switches
 * on a FINER subtype (`transportation`/`moving_help`/`tech_help`/…). The DB `category` column
 * is the only source of that finer signal, but it is mixed-vocabulary: on INSERT it gets the
 * same value as `request_type` (the enum), while older/seed/sim rows hold skill tokens
 * (`moving`, `tech_support`, `cooking`, …) that the matching SQL keys off. This map translates
 * the known aliases to the renderer vocabulary and returns `undefined` for everything else —
 * the renderer no-ops safely on an unknown type / empty payload, so unknown categories are a
 * safe fallback, never a regression.
 *
 * `PayloadType` mirrors the frontend `RequestType` union (apps/frontend/src/types/request-payloads.ts)
 * — the wire contract for the payload subtype the renderer accepts.
 */

export type PayloadType =
  | 'transportation'
  | 'moving_help'
  | 'childcare'
  | 'tech_help'
  | 'home_repair'
  | 'food'
  | 'pet_care'
  | 'event_help'
  | 'other';

const CATEGORY_TO_PAYLOAD_TYPE: Record<string, PayloadType> = {
  // Already aligned with the renderer vocabulary (new rows + some seed rows).
  transportation: 'transportation',
  childcare: 'childcare',
  home_repair: 'home_repair',
  pet_care: 'pet_care',
  food: 'food',
  moving_help: 'moving_help',
  tech_help: 'tech_help',
  // Legacy skill-token aliases the matching SQL keys off (older/seed/sim rows).
  ride: 'transportation',
  moving: 'moving_help',
  tech_support: 'tech_help',
  cooking: 'food',
};

/**
 * Translate a DB `category` value to the renderer's payload subtype. Unknown tokens, the coarse
 * `request_type` enum values (`generic`/`borrow`/`service`/`event`), and null/empty → `undefined`
 * (the renderer no-ops — safe, no regression).
 */
export function categoryToPayloadType(
  category: string | null | undefined,
): PayloadType | undefined {
  return category ? CATEGORY_TO_PAYLOAD_TYPE[category] : undefined;
}
