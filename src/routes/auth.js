import { Router } from 'express';
import bcrypt from 'bcryptjs';
const r = Router();

// 오류 노출 함수
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
    if (!email || !password)
      throw expose(400, 'E_VALIDATION', '이메일과 비밀번호를 입력해주세요.');

    const user = await req.models.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) throw expose(401, 'E_AUTH_INVALID', '이메일 또는 비밀번호가 올바르지 않습니다.');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw expose(401, 'E_AUTH_INVALID', '이메일 또는 비밀번호가 올바르지 않습니다.');

    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    next(e);
  }
});

// 회원가입
r.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password)
      throw expose(400, 'E_VALIDATION', '이름, 이메일, 비밀번호를 모두 입력해주세요.');

    const exists = await req.models.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (exists) throw expose(400, 'E_VALIDATION', '이미 가입된 이메일입니다.');

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await req.models.user.create({
      data: { name, email: email.toLowerCase().trim(), password: hashed },
    });

    res.json({ ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
  } catch (e) {
    next(e);
  }
});

export default r;
