import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import { sendMail } from '../lib/mailer.js';
import bcrypt from 'bcryptjs';

const router = Router();
const TOKEN_TTL_MIN = Number(process.env.PWRESET_TOKEN_TTL_MIN || 15);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://127.0.0.1';

router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: 'bad_request' });

    const user = await prisma.user.findUnique({ where: { email }});
    if (!user) return res.json({ ok: true }); // 존재 숨김

    const token = randomUUID().replace(/-/g,'');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

    const link = `${PUBLIC_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = '[MyApp] 비밀번호 재설정 링크';
    const text = `아래 링크로 비밀번호를 재설정하세요 (유효기간 ${TOKEN_TTL_MIN}분)\n${link}`;
    const html = `<p>아래 버튼으로 비밀번호를 재설정하세요 (유효 ${TOKEN_TTL_MIN}분)</p>
<p><a href="${link}">비밀번호 재설정</a></p>`;

    const result = await sendMail({ to: email, subject, text, html });
    res.json({ ok: true, delivery: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// 실제 재설정
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword) return res.status(400).json({ error: 'bad_request' });

    const row = await prisma.passwordReset.findUnique({ where: { token }});
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_or_expired' });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.passwordReset.update({ where: { token }, data: { usedAt: new Date() }}),
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash: hash }})
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
