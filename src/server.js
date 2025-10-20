import express from "express";
import morgan from "morgan";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

app.get("/api/hello", (req, res) => {
  res.send("hello");
});

app.get("/healthz", (req, res) => res.type("text").send("ok\n"));

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
