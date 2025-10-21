import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ACCESS_TTL = process.env.ACCESS_TTL || "15m";
const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TTL_SECONDS || "604800", 10); // 7d

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}
async function createRefreshToken(userId, trx = prisma) {
  const token = uuid();
  const now = new Date();
  const expires = new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000);
  const rt = await trx.refreshToken.create({ data: { token, userId, expiresAt: expires } });
  return rt.token;
}
async function revokeToken(token, _reason = "revoked", trx = prisma) {
  await trx.refreshToken.updateMany({ where: { token, revokedAt: null }, data: { revokedAt: new Date(), replacedBy: null } });
}
async function rotateRefreshToken(oldToken, userId, trx = prisma) {
  const newToken = await createRefreshToken(userId, trx);
  await trx.refreshToken.updateMany({ where: { token: oldToken }, data: { revokedAt: new Date(), replacedBy: newToken } });
  return newToken;
}
async function findValidRefresh(token) {
  const now = new Date();
  return prisma.refreshToken.findFirst({ where: { token, revokedAt: null, expiresAt: { gt: now } }, include: { user: true } });
}

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

router.post("/register", async (req, res) => {
  try {
    const { email, name, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "bad_request" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "email_exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name: name || null, passwordHash, role: "user" } });

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    return res.json({ accessToken, refreshToken });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "bad_request" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const accessToken = signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    return res.json({ accessToken, refreshToken });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "bad_request" });

  try {
    const found = await findValidRefresh(refreshToken);
    if (!found) return res.status(404).json({ error: "not_found" });

    const accessToken = signAccessToken(found.user);
    const newRefresh = await prisma.$transaction(async (trx) => {
      return await rotateRefreshToken(refreshToken, found.userId, trx);
    });

    return res.json({ accessToken, refreshToken: newRefresh });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "bad_request" });
  await revokeToken(refreshToken, "logout");
  return res.json({ ok: true });
});

router.post("/logout-all", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: new Date(), replacedBy: null },
  });
  return res.json({ ok: true });
});

export default router;
