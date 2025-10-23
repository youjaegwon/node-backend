export const success = (res, data = {}, status = 200) => {
  return res.status(status).json({ ok: true, ...data });
};

export const fail = (res, code = 'E_UNKNOWN', message = '알 수 없는 오류입니다.', status = 400) => {
  return res.status(status).json({ ok: false, code, message });
};
