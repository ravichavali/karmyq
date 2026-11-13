import { Router, Response } from 'express';
import { createLogger } from '@karmyq/shared/utils/logger';
import { getGovernanceState, createNomination, addRatification } from '../database/governanceDb';
import { GovernanceError } from '../database/governancePolicy';

const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const refuse = (res: Response,status: number,error: string,message: string) =>
  res.status(status).json({ success: false,message,error });
let fallbackLogger: ReturnType<typeof createLogger> | undefined;

router.use('/:communityId/governance', (req: any,res,next) => {
  if (!req.user?.userId) return refuse(res,401,'UNAUTHORIZED','Authentication required.');
  if (!validId(req.user.userId) || !validId(req.params.communityId)) {
    return refuse(res,400,'INVALID_REQUEST','Valid community and user identifiers are required.');
  }
  next();
});

const handle = (operation: (req: any) => Promise<unknown>,status = 200) => async (req: any,res: Response) => {
  try {
    res.status(status).json({ success: true,data: await operation(req) });
  } catch (error) {
    if (error instanceof GovernanceError) return refuse(res,error.status,error.code,error.message);
    const logger = req.logger ?? (fallbackLogger ??= createLogger('community-service'));
    logger.error('Governance operation failed',error instanceof Error ? error : new Error(String(error)), { route: req.route?.path });
    return refuse(res,500,'INTERNAL_ERROR','The governance operation could not be completed.');
  }
};

router.get('/:communityId/governance', handle(req => getGovernanceState(req.params.communityId,req.user.userId)));

router.post('/:communityId/governance/nominate', (req: any,res,next) => {
  if (!validId(req.body?.nominated_user_id) || !['admin','moderator'].includes(req.body?.role)) {
    return refuse(res,400,'INVALID_REQUEST','A valid nominee and role are required.');
  }
  next();
}, handle(req => createNomination({ communityId: req.params.communityId,nominatorId: req.user.userId,
  nominatedUserId: req.body.nominated_user_id,role: req.body.role }),201));

router.post('/:communityId/governance/ratify/:nominationId', (req: any,res,next) => {
  if (!validId(req.params.nominationId)) return refuse(res,400,'INVALID_REQUEST','A valid nomination identifier is required.');
  next();
}, handle(req => addRatification({ communityId: req.params.communityId,nominationId: req.params.nominationId,ratifierId: req.user.userId })));

export default router;
