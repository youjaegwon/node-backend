import express from "express";
import morgan from "morgan";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import authRouter, { authMiddleware } from "./auth.js";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/api/healthz", (_req, res) => res.type("text").send("ok"));
app.get("/api/version", (_req, res) =>
  res.json({
    app: process.env.APP_NAME || "node-backend",
    version: process.env.APP_VERSION || "0.0.0",
    commit: process.env.GIT_COMMIT || "unknown",
    builtAt: process.env.BUILD_TIME || "unknown",
    node: process.version,
  })
);

app.use("/api/auth", authRouter);

app.get("/api/me", authMiddleware, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
  });
  return res.json(me);
});

app.use((_req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.listen(PORT, () => console.log(`Server running on http://127.0.0.1:${PORT}`));
