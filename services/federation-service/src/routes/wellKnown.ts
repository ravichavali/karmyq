import { Router, Request, Response } from 'express';
import { getLocalInstance } from '../services/instanceService';

const router = Router();

/**
 * Instance discovery endpoint
 * GET /.well-known/karmyq
 */
router.get('/karmyq', async (req: Request, res: Response) => {
  try {
    const instance = await getLocalInstance();

    const baseUrl = `${req.protocol}://${instance.domain}`;

    res.json({
      domain: instance.domain,
      name: instance.name,
      description: instance.description,
      version: '4.0.0',
      publicKey: instance.public_key,
      inbox: `${baseUrl}/federation/inbox`,
      outbox: `${baseUrl}/federation/outbox`,
      users: `${baseUrl}/federation/users`,
      communities: `${baseUrl}/federation/communities`,
      protocol: 'karmyq-federation/0.1',
      features: ['communities', 'requests', 'reputation'],
      createdAt: instance.created_at,
    });
  } catch (error: any) {
    (req as any).logger?.error('Well-known endpoint error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to retrieve instance information',
      message: error.message,
    });
  }
});

/**
 * WebFinger endpoint for user discovery
 * GET /.well-known/webfinger?resource=acct:user@domain
 */
router.get('/webfinger', async (req: Request, res: Response) => {
  try {
    const resource = req.query.resource as string;

    if (!resource || !resource.startsWith('acct:')) {
      return res.status(400).json({
        error: 'Invalid resource parameter',
      });
    }

    // Parse acct:user@domain
    const acct = resource.replace('acct:', '');
    const [username, domain] = acct.split('@');

    const instance = await getLocalInstance();

    if (domain !== instance.domain) {
      return res.status(404).json({
        error: 'User not found on this instance',
      });
    }

    // TODO: Look up user in database
    // For now, return basic structure

    res.json({
      subject: resource,
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `${req.protocol}://${instance.domain}/federation/users/${username}`,
        },
      ],
    });
  } catch (error: any) {
    (req as any).logger?.error('WebFinger endpoint error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to process webfinger request',
      message: error.message,
    });
  }
});

export default router;
