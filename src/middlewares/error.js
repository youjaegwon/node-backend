export default function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code =
    err.code ||
    (status === 401 ? 'E_AUTH_INVALID'
     : status === 400 ? 'E_VALIDATION'
     : 'E_UNKNOWN');

  // expose === true 일 때만 메시지를 내려줌(내부 에러 감춤)
  const message =
    err.expose === true && typeof err.message === 'string'
      ? err.message
      : undefined;

  res.status(status).json({ ok:false, code, message });
}
