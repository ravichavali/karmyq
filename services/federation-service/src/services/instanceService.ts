import { query } from '../database/db';
import { generateKeyPair } from '../utils/crypto';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('federation-service:instance');

/**
 * Initialize or retrieve instance identity
 */
export async function getOrCreateInstanceIdentity() {
  const domain = process.env.INSTANCE_DOMAIN || 'localhost:3000';

  // Check if instance already exists
  const existing = await query(
    `SELECT * FROM federation.instances WHERE domain = $1 AND is_local = true`,
    [domain]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Generate new keypair for this instance
  const { publicKey, privateKey } = generateKeyPair();

  // Create instance record
  const result = await query(
    `INSERT INTO federation.instances
     (domain, name, description, public_key, private_key, is_local, status)
     VALUES ($1, $2, $3, $4, $5, true, 'active')
     RETURNING *`,
    [
      domain,
      process.env.INSTANCE_NAME || 'KarmyQ Instance',
      process.env.INSTANCE_DESCRIPTION || 'A mutual aid community',
      publicKey,
      privateKey,
    ]
  );

  logger.info('Instance identity created', { domain });
  return result.rows[0];
}

/**
 * Get local instance identity
 */
export async function getLocalInstance() {
  const result = await query(
    `SELECT * FROM federation.instances WHERE is_local = true LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('Local instance not initialized');
  }

  return result.rows[0];
}

/**
 * Discover remote instance
 */
export async function discoverInstance(domain: string) {
  // Fetch well-known endpoint
  const protocol = process.env.REQUIRE_HTTPS === 'true' ? 'https' : 'http';
  const url = `${protocol}://${domain}/.well-known/karmyq`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Instance discovery failed: ${response.statusText}`);
    }

    const instanceInfo = await response.json();

    // Store or update instance
    const existing = await query(
      `SELECT id FROM federation.instances WHERE domain = $1`,
      [domain]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE federation.instances
         SET name = $2, public_key = $3, inbox_url = $4, outbox_url = $5,
             software_version = $6, status = 'discovered', updated_at = CURRENT_TIMESTAMP
         WHERE domain = $1
         RETURNING *`,
        [
          domain,
          instanceInfo.name,
          instanceInfo.publicKey,
          instanceInfo.inbox,
          instanceInfo.outbox,
          instanceInfo.version,
        ]
      );
    } else {
      // Create new
      await query(
        `INSERT INTO federation.instances
         (domain, name, public_key, inbox_url, outbox_url, software_version, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'discovered')
         RETURNING *`,
        [
          domain,
          instanceInfo.name,
          instanceInfo.publicKey,
          instanceInfo.inbox,
          instanceInfo.outbox,
          instanceInfo.version,
        ]
      );
    }

    logger.info('Instance discovered', { domain, name: instanceInfo.name });
    return instanceInfo;
  } catch (error) {
    logger.error('Failed to discover instance', error instanceof Error ? error : new Error(String(error)), { domain });
    throw error;
  }
}

/**
 * Get all federated instances
 */
export async function getFederatedInstances(status?: string) {
  let queryText = `SELECT * FROM federation.instances WHERE is_local = false`;
  const params: any[] = [];

  if (status) {
    queryText += ` AND status = $1`;
    params.push(status);
  }

  queryText += ` ORDER BY created_at DESC`;

  const result = await query(queryText, params);
  return result.rows;
}

/**
 * Update instance status
 */
export async function updateInstanceStatus(
  domain: string,
  status: 'discovered' | 'accepted' | 'blocked'
) {
  await query(
    `UPDATE federation.instances
     SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE domain = $1`,
    [domain, status]
  );

  logger.info('Instance status updated', { domain, status });
}
