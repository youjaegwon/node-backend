export function notFound(req, res, next) {
  res.status(404).json({ ok: false, code: 'E_NOT_FOUND', message: '요청하신 경로가 존재하지 않습니다.' });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'E_UNKNOWN';
  const message = err.expose ? err.message : '서버 오류가 발생했습니다.';

  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorHandler]', err.stack || err);
  }

  res.status(status).json({ ok: false, code, message });
}
