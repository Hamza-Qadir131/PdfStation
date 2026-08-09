const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// List every user, with a count of how many jobs they've run.
router.get("/users", (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at,
              (SELECT COUNT(*) FROM jobs j WHERE j.user_id = u.id) AS job_count
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ users });
});

// Reset a user's password to a new value the admin chooses.
// The admin still never sees the user's original password — this sets a new one.
router.post("/users/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const password_hash = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, req.params.id);

  res.json({ ok: true });
});

module.exports = router;
