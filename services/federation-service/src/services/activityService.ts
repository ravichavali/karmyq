import { query } from '../database/db';
import { verifySignature, canonicalizeActivity, signData } from '../utils/crypto';
import { getLocalInstance } from './instanceService';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('federation-service:activity');

interface Activity {
  '@context': string;
  type: string;
  actor: string;
  object: any;
  signature?: string;
  published?: string;
}

/**
 * Process incoming activity from another instance
 */
export async function processInboxActivity(activity: Activity) {
  logger.info('Processing inbox activity', { type: activity.type, actor: activity.actor });

  // Verify signature
  if (activity.signature) {
    const isValid = await verifyActivitySignature(activity);
    if (!isValid) {
      throw new Error('Invalid activity signature');
    }
  }

  // Store in inbox
  await query(
    `INSERT INTO federation.inbox
     (activity_type, actor, object_data, raw_activity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      activity.type,
      activity.actor,
      JSON.stringify(activity.object),
      JSON.stringify(activity),
    ]
  );

  // Process based on activity type
  switch (activity.type) {
    case 'Create':
      await handleCreateActivity(activity);
      break;
    case 'Update':
      await handleUpdateActivity(activity);
      break;
    case 'Delete':
      await handleDeleteActivity(activity);
      break;
    case 'Follow':
      await handleFollowActivity(activity);
      break;
    case 'Accept':
      await handleAcceptActivity(activity);
      break;
    default:
      logger.warn('Unknown activity type', { type: activity.type });
  }
}

/**
 * Get outbox activities (activities from this instance)
 */
export async function getOutboxActivities(limit: number = 20, offset: number = 0) {
  const result = await query(
    `SELECT * FROM federation.outbox
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map((row) => JSON.parse(row.raw_activity));
}

/**
 * Send activity to remote instance
 */
export async function sendActivityToInstance(
  targetDomain: string,
  activity: Activity
) {
  // Get local instance for signing
  const localInstance = await getLocalInstance();

  // Sign the activity
  const canonical = canonicalizeActivity(activity);
  const signature = signData(canonical, localInstance.private_key);

  const signedActivity = {
    ...activity,
    signature,
  };

  // Get target instance inbox URL
  const instanceResult = await query(
    `SELECT inbox_url FROM federation.instances WHERE domain = $1`,
    [targetDomain]
  );

  if (instanceResult.rows.length === 0) {
    throw new Error(`Instance ${targetDomain} not found`);
  }

  const inboxUrl = instanceResult.rows[0].inbox_url;

  // Send to remote inbox
  try {
    const response = await fetch(inboxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json',
      },
      body: JSON.stringify(signedActivity),
    });

    if (!response.ok) {
      throw new Error(`Failed to send activity: ${response.statusText}`);
    }

    // Store in outbox
    await query(
      `INSERT INTO federation.outbox
       (activity_type, target_domain, object_data, raw_activity)
       VALUES ($1, $2, $3, $4)`,
      [
        activity.type,
        targetDomain,
        JSON.stringify(activity.object),
        JSON.stringify(signedActivity),
      ]
    );

    logger.info('Activity sent to instance', { targetDomain, activityType: activity.type });
  } catch (error) {
    logger.error('Failed to send activity to instance', error instanceof Error ? error : new Error(String(error)), { targetDomain });
    throw error;
  }
}

/**
 * Verify activity signature
 */
async function verifyActivitySignature(activity: Activity): Promise<boolean> {
  try {
    // Extract actor domain
    const actorUrl = new URL(activity.actor);
    const domain = actorUrl.host;

    // Get instance public key
    const instanceResult = await query(
      `SELECT public_key FROM federation.instances WHERE domain = $1`,
      [domain]
    );

    if (instanceResult.rows.length === 0) {
      logger.warn('Instance not found for signature verification', { domain });
      return false;
    }

    const publicKey = instanceResult.rows[0].public_key;

    // Verify signature
    const { signature, ...activityWithoutSignature } = activity;
    const canonical = canonicalizeActivity(activityWithoutSignature);

    return verifySignature(canonical, signature!, publicKey);
  } catch (error) {
    logger.error('Error verifying signature', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Handle Create activity (e.g., new request, new community)
 */
async function handleCreateActivity(activity: Activity) {
  const objectType = activity.object.type;

  switch (objectType) {
    case 'Request':
      await handleFederatedRequest(activity.object, activity.actor);
      break;
    case 'Community':
      await handleFederatedCommunity(activity.object, activity.actor);
      break;
    default:
      logger.warn('Unknown object type in Create activity', { objectType });
  }
}

/**
 * Handle Update activity
 */
async function handleUpdateActivity(activity: Activity) {
  // TODO: Implement update handling
  logger.info('Handling Update activity', { actor: activity.actor });
}

/**
 * Handle Delete activity
 */
async function handleDeleteActivity(activity: Activity) {
  // TODO: Implement delete handling
  logger.info('Handling Delete activity', { actor: activity.actor });
}

/**
 * Handle Follow activity (instance wants to federate)
 */
async function handleFollowActivity(activity: Activity) {
  logger.info('Handling Follow activity - federation request', { actor: activity.actor });
  // TODO: Implement auto-accept or require manual approval
}

/**
 * Handle Accept activity (federation request accepted)
 */
async function handleAcceptActivity(activity: Activity) {
  logger.info('Handling Accept activity - federation accepted', { actor: activity.actor });
}

/**
 * Store federated request
 */
async function handleFederatedRequest(requestObject: any, actor: string) {
  // Store in federated_requests table
  await query(
    `INSERT INTO federation.federated_requests
     (federated_id, title, description, category, urgency, home_instance_domain, created_by_federated_id, status, raw_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
     ON CONFLICT (federated_id) DO UPDATE
     SET title = $2, description = $3, updated_at = CURRENT_TIMESTAMP`,
    [
      requestObject.id,
      requestObject.title,
      requestObject.description,
      requestObject.category,
      requestObject.urgency,
      new URL(actor).host,
      actor,
      JSON.stringify(requestObject),
    ]
  );

  logger.info('Federated request stored', {
    federatedId: requestObject.id,
    title: requestObject.title,
    homeInstance: new URL(actor).host
  });
}

/**
 * Store federated community
 */
async function handleFederatedCommunity(communityObject: any, actor: string) {
  // Store in federated_communities table
  await query(
    `INSERT INTO federation.federated_communities
     (federated_id, name, description, home_instance_domain, member_count, raw_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (federated_id) DO UPDATE
     SET name = $2, description = $3, updated_at = CURRENT_TIMESTAMP`,
    [
      communityObject.id,
      communityObject.name,
      communityObject.description,
      new URL(actor).host,
      communityObject.memberCount || 0,
      JSON.stringify(communityObject),
    ]
  );

  logger.info('Federated community stored', {
    federatedId: communityObject.id,
    name: communityObject.name,
    homeInstance: new URL(actor).host
  });
}
