// routes/ninosRoutes.js
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');

function checkAccessToNino(session, nino) {
  if (!nino) return false;
  if (session.rol === 'admin') return true;
  if (session.rol === 'padre') return nino.padre_id === session.userId;
  if (session.rol === 'logopeda') return nino.logopeda_id === session.userId || nino.logopeda_id === null;
  return false;
}

function register(router) {
  // Crear niño (el padre se registra a sí mismo un niño; o el logopeda lo crea y asigna)
  router.post('/api/ninos', async (req, res, params, body) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const { nombre, edad, sexo, grado_hipoacusia, modo_comunicacion, usa_protesis, horas_protesis_dia, logopeda_id } = body;
    if (!nombre) return sendJson(res, 400, { error: 'El nombre del niño es obligatorio' });

    const padre_id = req.session.rol === 'padre' ? req.session.userId : (body.padre_id || null);

    const info = db.prepare(`
      INSERT INTO ninos (nombre, edad, sexo, grado_hipoacusia, modo_comunicacion, usa_protesis, horas_protesis_dia, logopeda_id, padre_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre, edad || null, sexo || null, grado_hipoacusia || null, modo_comunicacion || null,
      usa_protesis ? 1 : 0, horas_protesis_dia || null, logopeda_id || null, padre_id
    );
    sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
  });

  // Listar niños visibles para el usuario actual
  router.get('/api/ninos', async (req, res) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    let rows;
    if (req.session.rol === 'padre') {
      rows = db.prepare('SELECT * FROM ninos WHERE padre_id = ?').all(req.session.userId);
    } else if (req.session.rol === 'logopeda') {
      rows = db.prepare('SELECT * FROM ninos WHERE logopeda_id = ? OR logopeda_id IS NULL').all(req.session.userId);
    } else {
      rows = db.prepare('SELECT * FROM ninos').all();
    }
    sendJson(res, 200, { ninos: rows });
  });

  // Obtener un niño puntual
  router.get('/api/ninos/:id', async (req, res, params) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });
    sendJson(res, 200, { nino });
  });

  // Logopeda se asigna un niño (adopta uno sin asignar)
  router.put('/api/ninos/:id/asignar', async (req, res, params) => {
    if (!req.session || req.session.rol !== 'logopeda') return sendJson(res, 403, { error: 'Solo logopedas' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!nino) return sendJson(res, 404, { error: 'Niño no encontrado' });

    if (nino.logopeda_id && nino.logopeda_id !== req.session.userId) {
      db.prepare("INSERT INTO historial_asignaciones (nino_id, logopeda_id, accion) VALUES (?, ?, 'desasignado')")
        .run(params.id, nino.logopeda_id);
    }
    db.prepare('UPDATE ninos SET logopeda_id = ? WHERE id = ?').run(req.session.userId, params.id);
    db.prepare("INSERT INTO historial_asignaciones (nino_id, logopeda_id, accion) VALUES (?, ?, 'asignado')")
      .run(params.id, req.session.userId);

    sendJson(res, 200, { ok: true });
  });

  // Historial de niños asignados a un logopeda a lo largo del tiempo
  router.get('/api/logopeda/historial-asignaciones', async (req, res) => {
    if (!req.session || req.session.rol !== 'logopeda') return sendJson(res, 403, { error: 'Solo logopedas' });
    const rows = db.prepare(`
      SELECT h.*, n.nombre AS nino_nombre
      FROM historial_asignaciones h
      JOIN ninos n ON n.id = h.nino_id
      WHERE h.logopeda_id = ?
      ORDER BY h.creado_en DESC
    `).all(req.session.userId);
    sendJson(res, 200, { historial: rows });
  });
}

module.exports = { register, checkAccessToNino };
