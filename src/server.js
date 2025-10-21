// ESM
import express from "express";
import morgan from "morgan";                 // ← 한 번만 import (중복 금지)
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(morgan("tiny"));

// ────────────────────────────────────────────────────────────
// 환경/설정
// ────────────────────────────────────────────────────────────
const APP_NAME = process.env.APP_NAME || "node-backend";
const APP_VERSION = process.env.APP_VERSION || "0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const ACCESS_TTL = process.env.ACCESS_TTL || "15m";      // 15분
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);

// ────────────────────────────────────────────────────────────
// 도우미
// ────────────────────────────────────────────────────────────
function makeRefreshTokenString() {
  return crypto.randomUUID();
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || "user" },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

// ────────────────────────────────────────────────────────────
// 헬스/버전
// ────────────────────────────────────────────────────────────
app.get("/api/healthz", (_req, res) => res.type("text/plain").send("ok"));

app.get("/api/version", (_req, res) => {
  res.json({
    app: APP_NAME,
    version: APP_VERSION,
    commit: process.env.GIT_COMMIT || "unknown",
    builtAt: process.env.BUILD_TIME || "unknown",
    node: process.version,
  });
});

// ────────────────────────────────────────────────────────────
// 인증: 회원가입/로그인/토큰회전/로그아웃
// ────────────────────────────────────────────────────────────

// 회원가입
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, name, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email_password_required" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: "email_exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name || null, passwordHash, role: "user" },
      select: { id: true, email: true, name: true, role: true },
    });

    res.status(200).json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 로그인
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    // 새 RT 발급
    const rtRow = await prisma.refreshToken.create({
      data: {
        token: makeRefreshTokenString(),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, token: true },
    });

    const accessToken = signAccessToken(user);
    res.json({
      accessToken,
      refreshToken: rtRow.token,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 토큰 회전 (Refresh)
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "bad_request" });

    const old = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!old || old.revokedAt || old.expiresAt < new Date())
      return res.status(400).json({ error: "invalid_refresh_token" });

    // 새 RT 먼저 생성 → id(Int) 확보
    const newRow = await prisma.refreshToken.create({
      data: {
        token: makeRefreshTokenString(),
        userId: old.userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, token: true },
    });

    // 기존 RT revoke + replacedBy = 새 행의 id(Int)
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date(), replacedBy: newRow.id },
    });

    const accessToken = signAccessToken(old.user);
    res.json({ accessToken, refreshToken: newRow.token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 현재 RT 무효화 (단일 기기 로그아웃)
app.post("/api/auth/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "bad_request" });

    const row = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!row) return res.status(200).json({ ok: true }); // 이미 없음

    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 모든 기기 로그아웃 (AT 필요)
app.post("/api/auth/logout-all", authMiddleware, async (req, res) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 보호 API
app.get("/api/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json({ user });
});

// 존재하지 않음
app.all("/api/*", (_req, res) => res.status(404).json({ error: "not_found" }));

// ────────────────────────────────────────────────────────────
// 서버 시작
// ────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
