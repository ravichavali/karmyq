import crypto from 'crypto';
import { query } from '../database/db';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await query(
    `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );
}

export async function validateAndRotateRefreshToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);

  const result = await query(
    `SELECT id, user_id, used_at, revoked, expires_at
     FROM auth.refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!result.rows.length) return null;
  const record = result.rows[0];

  // Replay attack: token already used — revoke all tokens for this user
  if (record.used_at !== null) {
    await query(
      `UPDATE auth.refresh_tokens SET revoked = TRUE WHERE user_id = $1`,
      [record.user_id]
    );
    return null;
  }

  if (record.revoked || new Date(record.expires_at) < new Date()) return null;

  // Mark old token as used+revoked, issue new token
  await query(
    `UPDATE auth.refresh_tokens SET used_at = NOW(), revoked = TRUE WHERE id = $1`,
    [record.id]
  );

  const newRawToken = generateRawToken();
  await storeRefreshToken(record.user_id, newRawToken);
  return newRawToken;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE auth.refresh_tokens SET revoked = TRUE WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function getUserIdFromRefreshToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const result = await query(
    `SELECT user_id FROM auth.refresh_tokens
     WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0]?.user_id ?? null;
}
