import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}

/** 새 리프레시 토큰 발급 */
export async function issueRefreshToken(userId, meta = {}) {
  const raw = newOpaqueToken(48);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + parseTimespanMs(REFRESH_TOKEN_TTL));
  const rec = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    },
  });
  return { raw, record: rec };
}

/** 검증 + 회전(기존 토큰 revoke하고 새 토큰 발급) */
export async function rotateRefreshToken(rawToken, meta = {}) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const found = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!found) throw new Error("invalid_refresh");
  if (found.revokedAt) throw new Error("revoked");
  if (found.expiresAt <= now) throw new Error("expired");

  // (선택) UA/IP 매칭을 강제하려면 아래 주석 해제
  // if (found.userAgent && meta.userAgent && found.userAgent !== meta.userAgent) throw new Error("fingerprint_mismatch");

  // 새 토큰 발급
  const { raw: newRaw, record: newRec } = await issueRefreshToken(found.userId, meta);

  // 기존 토큰 revoke + replacedBy 연결
  await prisma.refreshToken.update({
    where: { id: found.id },
    data: { revokedAt: now, replacedBy: newRec.id },
  });

  return { newRaw, newRec };
}

/** 특정 raw 리프레시 토큰 무효화 */
export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const found = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (found && !found.revokedAt) {
    await prisma.refreshToken.update({ where: { id: found.id }, data: { revokedAt: now } });
  }
}

/** 사용자 모든 리프레시 토큰 무효화 */
export async function revokeAllForUser(userId) {
  const now = new Date();
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}

/** "15m", "30d" 같은 값을 ms로 */
function parseTimespanMs(s) {
  if (/^\d+$/.test(s)) return Number(s) * 1000; // seconds
  const m = String(s).match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
  return n * unit * 1000;
}
