require("dotenv").config();
const express = require("express");
const cors = require("cors");

const db = require("./db");
const { cleanupExpired } = require("./utils/storage");
const authRoutes = require("./routes/auth");
const toolsRoutes = require("./routes/tools");
const filesRoutes = require("./routes/files");

const app = express();
const PORT = process.env.PORT || 4000;

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",") }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/files", filesRoutes);

// Generic error handler (e.g. multer file-too-large errors land here)
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "That file is too large." });
  }
  res.status(500).json({ error: "Something went wrong on our end." });
});

// Sweep expired files once at startup, then every hour
cleanupExpired(db);
setInterval(() => cleanupExpired(db), 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`PDFStation API running on http://localhost:${PORT}`);
});
