/**
 * Founding-Circle Intake Routes (Sprint 96, ADR-076)
 *
 * Public, unauthenticated endpoint that captures founding-circle interest from the
 * static karmyq.org/join form into a review queue we own. Persist-only — no email
 * notify (the platform has no outbound email transport yet). Anti-spam is a honeypot
 * field plus app-level validation; the app-wide globalRateLimiter already applies, so
 * this router intentionally adds no per-route rate limiter.
 */

import { Router, Request, Response } from 'express';
import {
  sendSuccess,
  sendValidationError,
  sendInternalError,
  sendForbidden,
  sendNotFound,
  HTTP_STATUS,
} from '@karmyq/shared/utils/response';
import { authMiddleware, AuthenticatedRequest } from '@karmyq/shared/middleware';
import {
  insertFoundingCircleSubmission,
  FoundingCircleSubmission,
  FoundingCircleStatus,
  isFoundingCircleReviewer,
  listFoundingCircleSubmissions,
  updateFoundingCircleSubmissionStatus,
} from '../database/foundingCircleDb';

const router = Router();

// App-level length caps (the DB enforces the hard column limits too).
const EMAIL_MAX = 320; // RFC 5321
const LENS_MAX = 200;
const TEXT_MAX = 4000;

// Pragmatic email shape: non-space local, '@', dotted domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Optional free-text fields, each trimmed-or-null with a length cap.
const TEXT_FIELDS = [
  { key: 'lens', max: LENS_MAX, label: 'Lens' },
  { key: 'contribution', max: TEXT_MAX, label: 'Contribution' },
  { key: 'concern', max: TEXT_MAX, label: 'Concern' },
] as const;

const VALID_STATUSES: FoundingCircleStatus[] = ['new', 'reviewed', 'contacted', 'archived'];

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

export interface ValidationResult {
  ok: boolean;
  value?: FoundingCircleSubmission;
  drop?: boolean;
  error?: string;
}

/**
 * Validate + normalize a founding-circle submission body.
 * Returns `{ ok:true, drop:true }` for honeypot hits (silent drop signal),
 * `{ ok:true, value }` for clean input, or `{ ok:false, error }` on validation failure.
 */
export function validateSubmission(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'A valid submission body is required' };
  }

  const raw = body as Record<string, unknown>;

  // Honeypot: any non-empty value means bot traffic — silently drop.
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return { ok: true, drop: true };
  }

  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  if (!email) {
    return { ok: false, error: 'Email is required' };
  }
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'A valid email address is required' };
  }

  const fields: Record<string, string | null> = {};
  for (const { key, max, label } of TEXT_FIELDS) {
    const v = trimOrNull(raw[key]);
    if (v && v.length > max) {
      return { ok: false, error: `${label} must be ${max} characters or fewer` };
    }
    fields[key] = v;
  }

  return {
    ok: true,
    value: {
      email,
      lens: fields.lens,
      contribution: fields.contribution,
      concern: fields.concern,
      source_page: 'join',
    },
  };
}

function isValidStatus(status: unknown): status is FoundingCircleStatus {
  return typeof status === 'string' && VALID_STATUSES.includes(status as FoundingCircleStatus);
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

async function requireReviewer(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const requestId = (req as any).id;
  const userId = req.user?.userId;
  if (!userId || !(await isFoundingCircleReviewer(userId))) {
    sendForbidden(res, 'Founding-circle reviewer access required', { requestId });
    return false;
  }
  return true;
}

/**
 * POST /founding-circle/submissions
 * Public — no auth middleware. Persist a founding-circle note from the landing form.
 */
router.post('/submissions', async (req: Request, res: Response) => {
  const requestId = (req as any).id;
  const result = validateSubmission(req.body);

  if (!result.ok) {
    return sendValidationError(res, result.error || 'Invalid submission', undefined, { requestId });
  }

  // Honeypot hit: respond success without persisting (do not reveal filtering).
  if (result.drop) {
    return sendSuccess(res, { id: null, received: true }, HTTP_STATUS.CREATED, { requestId });
  }

  try {
    const id = await insertFoundingCircleSubmission(result.value!);
    return sendSuccess(res, { id }, HTTP_STATUS.CREATED, { requestId });
  } catch (error) {
    return sendInternalError(
      res,
      'Could not save submission',
      error instanceof Error ? error : undefined,
      { requestId }
    );
  }
});

router.get('/submissions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = (req as any).id;
  try {
    if (!(await requireReviewer(req, res))) return;

    const rawStatus = req.query.status;
    if (rawStatus !== undefined && !isValidStatus(rawStatus)) {
      return sendValidationError(res, 'Invalid status', { status: rawStatus }, { requestId });
    }
    const status = isValidStatus(rawStatus) ? rawStatus : undefined;

    const limit = parseBoundedInt(req.query.limit, 50, 1, 100);
    const offset = parseBoundedInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const data = await listFoundingCircleSubmissions({ status, limit, offset });
    return sendSuccess(res, data, HTTP_STATUS.OK, { requestId });
  } catch (error) {
    return sendInternalError(
      res,
      'Could not list submissions',
      error instanceof Error ? error : undefined,
      { requestId }
    );
  }
});

router.patch('/submissions/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = (req as any).id;
  try {
    if (!(await requireReviewer(req, res))) return;

    const status = req.body?.status;
    if (!isValidStatus(status)) {
      return sendValidationError(res, 'Invalid status', { status }, { requestId });
    }

    const updated = await updateFoundingCircleSubmissionStatus(req.params.id, status);
    if (!updated) return sendNotFound(res, 'Founding-circle submission', { requestId });

    return sendSuccess(res, updated, HTTP_STATUS.OK, { requestId });
  } catch (error) {
    return sendInternalError(
      res,
      'Could not update submission status',
      error instanceof Error ? error : undefined,
      { requestId }
    );
  }
});

export default router;
