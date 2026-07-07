// routes/authRoutes.js
'use strict';

const db = require('../db/database');
const { hashPassword, verifyPassword, createSession, destroySession } = require('../middleware/auth');
const { sendJson, setCookie, clearCookie } = require('../router');

function register(router) {
  // Registro de nuevo usuario (padre o logopeda)
  router.post('/api/auth/register', async (req, res, params, body) => {
    const { nombre, email, password, rol } = body;
    if (!nombre || !email || !password || !rol) {
      return sendJson(res, 400, { error: 'Faltan campos obligatorios' });
    }
    if (!['padre', 'logopeda'].includes(rol)) {
      return sendJson(res, 400, { error: 'Rol inválido' });
    }
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existing) {
      return sendJson(res, 409, { error: 'Ese correo ya está registrado' });
    }
    const passwordHash = hashPassword(password);
    const info = db.prepare(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'
    ).run(nombre, email, passwordHash, rol);

    const user = { id: info.lastInsertRowid, nombre, rol };
    const sid = createSession(user);
    setCookie(res, 'audipre_sid', sid, { maxAge: 60 * 60 * 24 * 7 });
    sendJson(res, 201, { ok: true, user: { id: user.id, nombre, rol, email } });
  });

  // Login
  router.post('/api/auth/login', async (req, res, params, body) => {
    const { email, password } = body;
    if (!email || !password) {
      return sendJson(res, 400, { error: 'Correo y contraseña requeridos' });
    }
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return sendJson(res, 401, { error: 'Credenciales incorrectas' });
    }
    const sid = createSession(user);
    setCookie(res, 'audipre_sid', sid, { maxAge: 60 * 60 * 24 * 7 });
    sendJson(res, 200, { ok: true, user: { id: user.id, nombre: user.nombre, rol: user.rol, email: user.email } });
  });

  // Logout
  router.post('/api/auth/logout', async (req, res) => {
    if (req.sessionId) destroySession(req.sessionId);
    clearCookie(res, 'audipre_sid');
    sendJson(res, 200, { ok: true });
  });

  // Sesión actual
  router.get('/api/auth/me', async (req, res) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    sendJson(res, 200, { user: req.session });
  });
}

module.exports = { register };
