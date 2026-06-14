/**
 * Founding-circle intake client (Sprint 96, ADR-076).
 *
 * The landing app is a static export served from karmyq.org, while the API lives on
 * karmyq.com. This POSTs the join-form fields cross-origin to the auth-service intake
 * endpoint. The base URL is baked in at build time from NEXT_PUBLIC_API_URL (deploy.sh
 * sources .env.demo before `next build`); the fallback is the production API host, NOT
 * localhost/relative — an unset base in the deployed bundle must still reach a real API.
 */

const PROD_API_BASE = 'https://karmyq.com/api';

export interface FoundingCircleInput {
  email: string;
  lens: string;
  contribution: string;
  concern: string;
  website: string; // honeypot — must be empty for real users
}

export interface SubmitResult {
  ok: boolean;
  message?: string;
}

function resolveApiBase(): string {
  // Accept NEXT_PUBLIC_API_URL only when it is ABSOLUTE. The demo shares this var
  // with apps/frontend, where it is set to the relative `/api` (same-origin on
  // karmyq.com). The landing bundle is served cross-origin from karmyq.org, so a
  // relative base would resolve to karmyq.org/api, which does not exist — treat
  // any non-http(s) value as unset and fall through to the production API host.
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  // Only fall back to localhost in non-production dev; the deployed static bundle
  // must never POST to a relative/localhost base. Default everywhere else to the
  // real production API host.
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }
  return PROD_API_BASE;
}

export async function submitFoundingCircle(input: FoundingCircleInput): Promise<SubmitResult> {
  const base = resolveApiBase();
  try {
    const res = await fetch(`${base}/founding-circle/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (res.ok) {
      return { ok: true };
    }

    let message = 'Something went wrong. Please try again.';
    try {
      const data = await res.json();
      if (data && typeof data.message === 'string' && data.message.trim() !== '') {
        message = data.message;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    return { ok: false, message };
  } catch {
    return { ok: false, message: 'Could not reach the server. Please try again.' };
  }
}
