// middleware/auth.js
// Autenticación simple sin dependencias externas: hash con crypto nativo
// y sesiones guardadas en memoria + cookie de sesión.
'use strict';

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Hash de contraseñas (scrypt, nativo de Node, sin necesidad de bcrypt)
// ---------------------------------------------------------------------------
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(':');
  const hashToCompare = crypto.scryptSync(plain, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashToCompare, 'hex'));
}

// ---------------------------------------------------------------------------
// Sesiones en memoria: { sessionId -> { userId, rol, nombre } }
// ---------------------------------------------------------------------------
const sessions = new Map();

function createSession(user) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { userId: user.id, rol: user.rol, nombre: user.nombre });
  return sid;
}

function getSession(sid) {
  return sessions.get(sid) || null;
}

function destroySession(sid) {
  sessions.delete(sid);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

// Middleware: adjunta req.session (o null) según la cookie 'audipre_sid'
function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req);
  const sid = cookies['audipre_sid'];
  req.sessionId = sid || null;
  req.session = sid ? getSession(sid) : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No autenticado' }));
    return;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !roles.includes(req.session.rol)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No autorizado' }));
      return;
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  sessionMiddleware,
  requireAuth,
  requireRole,
};
