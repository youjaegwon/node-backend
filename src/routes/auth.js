import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

const r = Router();

// 클라이언트에 노출 가능한 에러 생성 헬퍼
const expose = (status, code, message) => {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  e.expose = true;
  return e;
};

// 로그인
r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw expose(400, 'E_VALIDATION', '이메일과 비밀번호를 입력해주세요.');
    }

    const normEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normEmail } });
    if (!user) throw expose(401, 'E_AUTH_INVALID', '이메일 또는 비밀번호가 올바르지 않습니다.');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw expose(401, 'E_AUTH_INVALID', '이메일 또는 비밀번호가 올바르지 않습니다.');

    // 토큰은 우선 더미로 (나중에 JWT로 교체 가능)
    const token = 'fake.jwt.token';

    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (e) { next(e); }
});

// 회원가입
r.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      throw expose(400, 'E_VALIDATION', '이름, 이메일, 비밀번호를 모두 입력해주세요.');
    }

    const normEmail = String(email).trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normEmail } });
    if (exists) throw expose(400, 'E_VALIDATION', '이미 가입된 이메일입니다.');

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: { name, email: normEmail, passwordHash: hashed },
    });

    res.status(201).json({
      ok: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (e) { next(e); }
});

export default r;
