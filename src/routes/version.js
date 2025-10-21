import { Router } from 'express';
import { verifyAccess } from '../lib/jwt.js';

const router = Router();

router.get('/version', (_req, res) => {
  res.json({
    app: process.env.APP_NAME || 'node-backend',
    version: process.env.APP_VERSION || '0.0.0',
    commit: process.env.GIT_COMMIT || 'unknown',
    builtAt: process.env.BUILD_TIME || 'unknown',
    node: process.version
  });
});

router.get('/me', (req, res) => {
  const h = req.get('authorization') || '';
  const m = h.match(/^Bearer (.+)$/i);
  if (!m) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = verifyAccess(m[1]);
    res.json({ id: payload.id, email: payload.email, role: payload.role });
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
});

export default router;
