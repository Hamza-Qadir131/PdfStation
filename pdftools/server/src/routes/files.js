const express = require("express");
const fs = require("fs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Download (or re-download) a finished job's output file
router.get("/:jobId", requireAuth, (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(req.params.jobId, req.user.id);
  if (!job) return res.status(404).json({ error: "File not found or it has expired." });
  if (!fs.existsSync(job.output_path)) return res.status(410).json({ error: "This file has expired." });

  res.download(job.output_path, job.output_name);
});

// List the logged-in user's recent jobs, for the dashboard
router.get("/", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, tool, input_name, output_name, created_at, expires_at
       FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(req.user.id);
  res.json({ jobs: rows });
});

module.exports = router;
