export const expose = (status, code, message) => {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  e.expose = true;
  return e;
};
