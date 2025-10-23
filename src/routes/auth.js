import { Router } from 'express';
const r = Router();

const expose = (status, code, message) => {
  const e = new Error(message);
  e.status = status; e.code = code; e.expose = true;
  return e;
};

r.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw expose(400, 'E_VALIDATION', '필수 값 누락');

    // TODO: 실제 DB/해시 검증으로 교체
    const okUser = email === 'test@example.com' && password === 'pass1234';
    if (!okUser) throw expose(401, 'E_AUTH_INVALID', '아이디 또는 비밀번호가 올바르지 않습니다.');

    res.json({ ok:true, token:'fake.jwt.token',
      user:{ id:1, name:'테스트', email } });
  } catch (e) { next(e); }
});

r.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) throw expose(400, 'E_VALIDATION', '필수 값 누락');

    // TODO: 중복 체크 예시
    const exists = false; // 중복 시 true
    if (exists) throw expose(400, 'E_DUPLICATE', '이미 사용 중인 이메일입니다.');

    res.status(201).json({ ok:true });
  } catch (e) { next(e); }
});

export default r;
