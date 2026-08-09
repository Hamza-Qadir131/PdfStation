const multer = require("multer");

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 25);

// Keep uploads in memory — they're small, short-lived, and we only need
// them long enough to process into an output file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
