export function ok(res, data = {}) {
  return res.status(200).json({ ok: true, data });
}

export function err(res, http = 400, code = 'BAD_REQUEST', message = 'Bad request', extra = undefined) {
  const payload = { ok: false, code, message };
  if (extra) payload.extra = extra;
  return res.status(http).json(payload);
}

// 공통 에러 핸들러 (마지막 미들웨어에 장착)
export function errorHandler(errObj, req, res, _next) {
  console.error('[UNHANDLED]', errObj);
  return res.status(500).json({
    ok: false,
    code: 'SERVER_ERROR',
    message: '서버 오류가 발생했습니다.',
  });
}
