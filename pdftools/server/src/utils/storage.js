const fs = require("fs");
const path = require("path");

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";
const OUTPUT_DIR = path.join(STORAGE_PATH, "outputs");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function outputPath(filename) {
  return path.join(OUTPUT_DIR, filename);
}

// Files older than this are deleted by the cleanup sweep (see index.js)
const FILE_TTL_HOURS = 24;

function expiresAtISO() {
  const d = new Date(Date.now() + FILE_TTL_HOURS * 60 * 60 * 1000);
  return d.toISOString();
}

function cleanupExpired(db) {
  const now = new Date().toISOString();
  const expired = db.prepare("SELECT id, output_path FROM jobs WHERE expires_at < ?").all(now);
  for (const job of expired) {
    fs.promises.unlink(job.output_path).catch(() => {});
  }
  db.prepare("DELETE FROM jobs WHERE expires_at < ?").run(now);
}

module.exports = { OUTPUT_DIR, outputPath, expiresAtISO, cleanupExpired, FILE_TTL_HOURS };
