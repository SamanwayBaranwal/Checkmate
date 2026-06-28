import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getUserMissions } from '../services/missions';

const router = Router();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const result = await getUserMissions(req.userId!);
  res.json(result);
});

export default router;
