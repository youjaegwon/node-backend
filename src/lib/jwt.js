import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'dev-access';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh';

export const signAccess = (payload, exp = '15m') =>
  jwt.sign(payload, JWT_ACCESS_SECRET,  { expiresIn: exp });

export const signRefresh = (payload, exp = '30d') =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: exp });

export const verifyAccess  = (t) => jwt.verify(t, JWT_ACCESS_SECRET);
export const verifyRefresh = (t) => jwt.verify(t, JWT_REFRESH_SECRET);
