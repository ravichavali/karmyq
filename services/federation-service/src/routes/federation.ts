import { Router, Request, Response } from 'express';
import {
  getLocalInstance,
  getFederatedInstances,
  discoverInstance,
  updateInstanceStatus,
} from '../services/instanceService';
import { processInboxActivity, getOutboxActivities } from '../services/activityService';

const router = Router();

/**
 * GET /federation/instances
 * List all federated instances
 */
router.get('/instances', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const instances = await getFederatedInstances(status as string);

    res.json({
      success: true,
      data: instances,
      count: instances.length,
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to fetch instances', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: 'Failed to fetch instances',
      message: error.message,
    });
  }
});

/**
 * POST /federation/instances/discover
 * Discover a new instance
 */
router.post('/instances/discover', async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
    }

    const instanceInfo = await discoverInstance(domain);

    res.json({
      success: true,
      data: instanceInfo,
      message: `Instance ${domain} discovered successfully`,
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to discover instance', error instanceof Error ? error : new Error(String(error)), {
      domain: req.body.domain
    });
    res.status(500).json({
      success: false,
      error: 'Failed to discover instance',
      message: error.message,
    });
  }
});

/**
 * PUT /federation/instances/:domain/status
 * Update instance federation status (accept/block)
 */
router.put('/instances/:domain/status', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const { status } = req.body;

    if (!['accepted', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "accepted" or "blocked"',
      });
    }

    await updateInstanceStatus(domain, status);

    res.json({
      success: true,
      message: `Instance ${domain} ${status}`,
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to update instance status', error instanceof Error ? error : new Error(String(error)), {
      domain: req.params.domain,
      status: req.body.status
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update instance status',
      message: error.message,
    });
  }
});

/**
 * POST /federation/inbox
 * Receive activities from other instances
 */
router.post('/inbox', async (req: Request, res: Response) => {
  try {
    const activity = req.body;

    // Process the activity
    await processInboxActivity(activity);

    res.status(202).json({
      success: true,
      message: 'Activity accepted for processing',
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to process inbox activity', error instanceof Error ? error : new Error(String(error)), {
      activityType: req.body.type,
      actor: req.body.actor
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process activity',
      message: error.message,
    });
  }
});

/**
 * GET /federation/outbox
 * Get activities from this instance
 */
router.get('/outbox', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const activities = await getOutboxActivities(
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to fetch outbox', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      success: false,
      error: 'Failed to fetch outbox',
      message: error.message,
    });
  }
});

/**
 * GET /federation/users/:userId
 * Get federated user profile
 */
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const instance = await getLocalInstance();

    // TODO: Fetch user from database
    // For now, return basic structure

    res.json({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Person',
      id: `${req.protocol}://${instance.domain}/federation/users/${userId}`,
      preferredUsername: userId,
      inbox: `${req.protocol}://${instance.domain}/federation/inbox`,
      outbox: `${req.protocol}://${instance.domain}/federation/outbox`,
    });
  } catch (error: any) {
    (req as any).logger?.error('Failed to fetch user', error instanceof Error ? error : new Error(String(error)), {
      userId: req.params.userId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message,
    });
  }
});

export default router;
