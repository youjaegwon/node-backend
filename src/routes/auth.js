import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hash, compare } from '../lib/hash.js';
import { signAccess } from '../lib/jwt.js';
import { randomUUID } from 'crypto';

const router = Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'bad_request' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'email_exists' });

    const passwordHash = await hash(password);
    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash },
      select: { id: true, email: true, name: true, role: true }
    });

    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 로그인 (AT/RT 발급)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const accessToken  = signAccess({ id: user.id, email: user.email, role: user.role });

    // RefreshToken: DB row + 문자열 토큰 분리
    const rawToken = randomUUID().replace(/-/g, '');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: rawToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30d
      },
      select: { id: true }
    });

    res.json({ accessToken, refreshToken: rawToken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 토큰 갱신 (회전)
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: 'bad_request' });

    const now = new Date();
    const found = await prisma.refreshToken.findUnique({ where: { token: refreshToken }});
    if (!found || found.revokedAt || found.expiresAt <= now) {
      return res.status(401).json({ error: 'invalid_refresh' });
    }

    // 새 RT 생성
    const newRaw = randomUUID().replace(/-/g, '');
    const newRow = await prisma.refreshToken.create({
      data: {
        userId: found.userId,
        token: newRaw,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      },
      select: { id: true }
    });

    // 이전 RT 무효화 + replacedBy (Int)
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: now, replacedBy: newRow.id }
    });

    // AT 재발급
    const user = await prisma.user.findUnique({ where: { id: found.userId } });
    const accessToken = signAccess({ id: user.id, email: user.email, role: user.role });

    res.json({ accessToken, refreshToken: newRaw });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 로그아웃(현재 RT 무효화)
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: 'bad_request' });

    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 전체 로그아웃(모든 기기)
router.post('/logout-all', async (req, res) => {
  try {
    const h = req.get('authorization') || '';
    const m = h.match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ error: 'unauthorized' });

    // AT payload만 쓰고, 모든 RT revoke
    const base64 = m[1].split('.')[1];
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    await prisma.refreshToken.updateMany({
      where: { userId: payload.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
