import jwt from "jsonwebtoken";
import { prisma } from "./db.js"; // 프로젝트에서 prisma 클라이언트 불러오던 방식 유지
import bcrypt from "bcryptjs";

/** 토큰 유틸 */
const AT_EXPIRES_SEC = 60 * 10;          // 10분
const RT_EXPIRES_SEC = 60 * 60 * 24 * 7; // 7일

const signAT = (user) =>
  jwt.sign({ uid: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: AT_EXPIRES_SEC });

const signRT = () =>
  jwt.sign({ typ: "refresh", jti: cryptoRandom() }, process.env.JWT_SECRET, { expiresIn: RT_EXPIRES_SEC });

function cryptoRandom() {
  // 간단 난수 문자열
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** 쿠키 처리 */
function setAuthCookies(res, { accessToken, refreshToken }) {
  const isSecure = false; // HTTPS면 true 권장
  res.cookie("AT", accessToken, {
    httpOnly: true, sameSite: "lax", secure: isSecure, maxAge: AT_EXPIRES_SEC * 1000, path: "/",
  });
  res.cookie("RT", refreshToken, {
    httpOnly: true, sameSite: "lax", secure: isSecure, maxAge: RT_EXPIRES_SEC * 1000, path: "/api/auth",
  });
}

function clearAuthCookies(res) {
  res.clearCookie("AT", { path: "/" });
  res.clearCookie("RT", { path: "/api/auth" });
}

function getATFromReq(req) {
  // Authorization 헤더가 있으면 우선 사용, 없으면 쿠키 AT
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  return req.cookies?.AT;
}
function getRTFromReq(req) {
  // 바디/쿠키 모두 허용 (쿠키 우선)
  return req.cookies?.RT || req.body?.refreshToken;
}

/** 미들웨어 */
export async function authMiddleware(req, res, next) {
  try {
    const token = getATFromReq(req);
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

/** 회원가입 */
export async function register(req, res) {
  try {
    const { email, name, password } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "email_exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, passwordHash } });
    return res.json({ id: user.id, email: user.email });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
}

/** 로그인 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid_credential" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credential" });

    // RT를 DB에 저장 (jti 추출)
    const refreshToken = signRT();
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + RT_EXPIRES_SEC * 1000) }
    });

    const accessToken = signAT(user);
    setAuthCookies(res, { accessToken, refreshToken });
    return res.json({ ok: true }); // 토큰은 쿠키로만 내려감
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
}

/** 리프레시 */
export async function refresh(req, res) {
  try {
    const rt = getRTFromReq(req);
    if (!rt) return res.status(401).json({ error: "unauthorized" });

    let payload;
    try { payload = jwt.verify(rt, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: "unauthorized" }); }

    // DB에 존재/미폐기 확인
    const row = await prisma.refreshToken.findUnique({ where: { token: rt } });
    if (!row || row.revokedAt) return res.status(401).json({ error: "unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) return res.status(401).json({ error: "unauthorized" });

    // 새 RT 교체 (회전)
    const newRT = signRT();
    await prisma.$transaction([
      prisma.refreshToken.update({ where: { token: rt }, data: { revokedAt: new Date(), replacedBy: newRT } }),
      prisma.refreshToken.create({ data: { token: newRT, userId: user.id, expiresAt: new Date(Date.now() + RT_EXPIRES_SEC*1000) }})
    ]);

    const newAT = signAT(user);
    setAuthCookies(res, { accessToken: newAT, refreshToken: newRT });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
}

/** 현재 RT만 폐기 (현재 기기 로그아웃) */
export async function logout(req, res) {
  try {
    const rt = getRTFromReq(req);
    if (rt) {
      await prisma.refreshToken.updateMany({ where: { token: rt, revokedAt: null }, data: { revokedAt: new Date() }});
    }
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
}

/** 전체 기기 로그아웃 (AT 필요) */
export async function logoutAll(req, res) {
  try {
    const token = getATFromReq(req);
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    await prisma.refreshToken.updateMany({ where: { userId: payload.uid, revokedAt: null }, data: { revokedAt: new Date() }});
    clearAuthCookies(res);
    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
