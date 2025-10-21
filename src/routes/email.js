import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { sendMail } from '../lib/mailer.js';

const router = Router();
const TOKEN_TTL_MIN = Number(process.env.EMAIL_TOKEN_TTL_MIN || 15);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://127.0.0.1';

router.post('/request-verify', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: 'bad_request' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ ok: true }); // 존재 숨김

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);
    await prisma.emailVerification.create({ data: { userId: user.id, token, expiresAt } });

    const link = `${PUBLIC_BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const subject = '[MyApp] 이메일 인증 링크';
    const text = `아래 링크를 클릭해 이메일 인증을 완료하세요 (유효기간 ${TOKEN_TTL_MIN}분)\n${link}`;
    const html = `<p>아래 버튼을 클릭해 이메일 인증을 완료하세요 (유효 ${TOKEN_TTL_MIN}분)</p>
<p><a href="${link}">이메일 인증하기</a></p>`;

    const result = await sendMail({ to: email, subject, text, html });
    res.json({ ok: true, delivery: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// (GET 지원) 인증 완료
router.get('/verify', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'bad_request' });

    const row = await prisma.emailVerification.findUnique({ where: { token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_token' });
    }

    await prisma.emailVerification.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    // 필요시 User에 표시(별도 필드 없다면 스킵/로그로 대체)
    // await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });

    res.type('text').send('Email verified. You can close this page.');
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// (POST 지원) 인증 완료
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body ?? {};
    if (!token) return res.status(400).json({ error: 'bad_request' });
    const row = await prisma.emailVerification.findUnique({ where: { token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_token' });
    }
    await prisma.emailVerification.update({
      where: { token },
      data: { usedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
