import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

const APP_NAME    = process.env.APP_NAME    || "node-backend";
const APP_VERSION = process.env.APP_VERSION || "0.0.0";
const GIT_COMMIT  = process.env.GIT_COMMIT  || "unknown";
const BUILD_TIME  = process.env.BUILD_TIME  || "unknown";

const JWT_SECRET      = process.env.JWT_SECRET || "changeme";
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN || "15m"; // 액세스 토큰 만료
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 14);

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// ===== 유틸 =====
function signAccessToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function issueRefreshToken(userId, meta = {}) {
  const token = randomUUID() + "." + randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 24*60*60*1000);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      issuedAt: now,
      expiresAt,
      ip: meta.ip || null,
      ua: meta.ua || null
    }
  });
  return token;
}

async function rotateRefreshToken(oldTokenStr, meta = {}) {
  const old = await prisma.refreshToken.findUnique({ where: { token: oldTokenStr }});
  if (!old) throw new Error("not_found");
  if (old.revokedAt) throw new Error("revoked");
  if (old.expiresAt < new Date()) throw new Error("expired");

  // 새 발급
  const newToken = await issueRefreshToken(old.userId, meta);

  // 이전 토큰 무효화 + 연결
  await prisma.refreshToken.update({
    where: { token: oldTokenStr },
    data: { revokedAt: new Date(), replacedBy: newToken }
  });

  return newToken;
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)/i);
  if (!m) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = { id: payload.uid, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

// ===== 헬스/정보 =====
app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/api/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/api/hello", (_req, res) => res.send("hello"));
app.get("/api/version", (_req, res) => {
  res.json({
    app: APP_NAME,
    version: APP_VERSION,
    commit: GIT_COMMIT,
    builtAt: BUILD_TIME,
    node: process.version
  });
});
app.get("/api/db/ping", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.type("text").send("ok");
  } catch (e) {
    res.status(500).json({ error: "db_unavailable" });
  }
});

// ===== 인증 =====
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, name, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "bad_request" });
    const exists = await prisma.user.findUnique({ where: { email }});
    if (exists) return res.status(409).json({ error: "email_exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash, role: "user" }
    });

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(
      user.id,
      { ip: req.ip, ua: req.headers["user-agent"] }
    );

    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email }});
    if (!user) return res.status(401).json({ error: "invalid_cred" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_cred" });

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, { ip: req.ip, ua: req.headers["user-agent"] });
    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, role: true }});
  res.json(u ?? { error: "not_found" });
});

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "bad_request" });

    const newRT = await rotateRefreshToken(refreshToken, { ip: req.ip, ua: req.headers["user-agent"] });
    const record = await prisma.refreshToken.findUnique({ where: { token: newRT }, include: { user: true }});
    const accessToken = signAccessToken(record.user);
    res.json({ accessToken, refreshToken: newRT });
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "bad_request" });
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  res.type("text").send("ok");
});

app.post("/api/auth/logout-all", authMiddleware, async (req, res) => {
  await prisma.refreshToken.updateMany({
    where: { userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  res.type("text").send("ok");
});

// 404 핸들링
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
