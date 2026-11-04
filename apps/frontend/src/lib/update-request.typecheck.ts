/**
 * Sprint 136 (BUG-086): the server derives a request's status and PUT /requests/:id refuses one (400
 * STATUS_NOT_EDITABLE), so the client must not offer the field. Compile-time only: if `status` comes back, the
 * directive below is unused and the type check fails with TS2578.
 */
import type { requestService } from "./api";

type UpdateRequestBody = Parameters<typeof requestService.updateRequest>[1];

// @ts-expect-error status is not editable
export const withStatus: UpdateRequestBody = { user_id: "u", status: "completed" };
