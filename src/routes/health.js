import { Router } from 'express';
const router = Router();

router.get('/healthz', (_req, res) => res.type('text').send('ok'));

export default router;
