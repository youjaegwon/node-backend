import express from "express";
import morgan from "morgan";
import cors from "cors";
import 'dotenv/config';
import pkg from "pg"; // (연결 확인 라우트에서 사용 가능)
import { PrismaClient } from "@prisma/client";

const app = express();
const PORT = process.env.PORT || 3000;

// (선택) pg Pool - /api/db/ping에서 사용
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Prisma
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));
import { register, login, authMiddleware } from "./auth.js";
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.get("/api/me", authMiddleware, (req, res) => {
  const u = req.user; res.json({ id:u.id, email:u.email, name:u.name, role:u.role });
});

app.get("/api/hello", (_req, res) => res.send("hello"));
app.get("/api/version", (_req, res) => {
  res.json({
    app: process.env.APP_NAME || "node-backend",
    version: process.env.APP_VERSION || "0.0.0",
    commit: process.env.GIT_COMMIT || "unknown",
    builtAt: process.env.BUILD_TIME || "unknown",
    node: process.version,
  });
});

// DB ping
app.get("/api/db/ping", async (_req, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({ ok: r.rows[0].ok });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db_error" });
  }
});

// Users CRUD (mini)
// 목록
app.get("/api/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: "desc" } });
  res.json(users);
});

// 단건 조회
app.get("/api/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json(user);
});

// 생성
app.post("/api/users", async (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ error: "email_required" });
  try {
    const created = await prisma.user.create({ data: { email, name } });
    res.status(201).json(created);
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ error: "email_unique" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 수정
app.put("/api/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  try {
    const updated = await prisma.user.update({ where: { id }, data: { name } });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "not_found" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// 삭제
app.delete("/api/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "not_found" });
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/healthz", (_req, res) => res.type("text").send("ok\n"));

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

// --- Auth (refresh/logout) ---
app.post("/api/auth/refresh", refresh);
app.post("/api/auth/logout", logout);
app.post("/api/auth/logout-all", authMiddleware, logoutAll);
// --- /Auth ---
