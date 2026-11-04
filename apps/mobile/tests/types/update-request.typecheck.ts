/**
 * Sprint 136 (BUG-086): the server derives a request's status and PUT /requests/:id refuses one (400
 * STATUS_NOT_EDITABLE), so the client must not offer the field. Compile-time only: if `status` comes back, the
 * directive below is unused and tsc fails with TS2578. CI type-checks this workspace (ci.yml, mobile type-check).
 */
import type { api } from "../../services/api";

type UpdateRequestBody = Parameters<typeof api.updateRequest>[1];

// @ts-expect-error status is not editable
export const withStatus: UpdateRequestBody = { user_id: "u", status: "completed" };
