const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Log in to use this tool." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Your session expired. Log in again." });
  }
}

// Doesn't block the request if there's no token, but attaches the user if there is one
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // ignore invalid token for optional routes
    }
  }
  next();
}

// Must be used after requireAuth. Only lets the configured admin email through.
function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const userEmail = (req.user?.email || "").toLowerCase().trim();
  if (!adminEmail || userEmail !== adminEmail) {
    return res.status(403).json({ error: "Not authorized." });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
