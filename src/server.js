import express from "express";
import morgan from "morgan";
import cors from "cors";
import 'dotenv/config';
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

app.get("/api/hello", (_req, res) => {
  res.send("hello");
});

app.get("/api/db/ping", async (_req, res) => {
  try {
    const result = await pool.query("SELECT 1 as ok");
    res.json({ ok: result.rows[0].ok });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/healthz", (_req, res) => res.type("text").send("ok\n"));

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
