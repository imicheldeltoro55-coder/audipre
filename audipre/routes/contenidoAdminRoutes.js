// routes/contenidoAdminRoutes.js
// CRUD de ejercicios y temas del folleto, exclusivo del rol 'logopeda'.
// Cada crear/editar/activar/desactivar queda registrado en
// historial_cambios_contenido para auditoría.
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');

function soloLogopeda(req, res) {
  if (!req.session || req.session.rol !== 'logopeda') {
    sendJson(res, 403, { error: 'Solo un logopeda puede administrar el contenido' });
    return false;
  }
  return true;
}

function registrarCambio(logopedaId, tipo, contenidoId, accion, detalle) {
  db.prepare(`
    INSERT INTO historial_cambios_contenido (logopeda_id, tipo_contenido, contenido_id, accion, detalle)
    VALUES (?, ?, ?, ?, ?)
  `).run(logopedaId, tipo, contenidoId, accion, detalle || null);
}

function register(router) {
  // -------------------------------------------------------------------
  // EJERCICIOS
  // -------------------------------------------------------------------

  // Crear ejercicio (acepta JSON normal o multipart si trae archivos)
  router.post('/api/admin/ejercicios', async (req, res, params, body, files) => {
    if (!soloLogopeda(req, res)) return;
    const b = body || {};
    const f = files || {};
    if (!b.categoria || !b.titulo) {
      return sendJson(res, 400, { error: 'Categoría y título son obligatorios' });
    }
    const info = db.prepare(`
      INSERT INTO ejercicios (categoria, titulo, descripcion, video_url, video_archivo, imagen_url, imagen_archivo, orden, activo, creado_por, actualizado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      b.categoria, b.titulo, b.descripcion || null,
      b.video_url || null, f.video_archivo || null,
      b.imagen_url || null, f.imagen_archivo || null,
      b.orden ? Number(b.orden) : 0,
      req.session.userId, req.session.userId
    );
    registrarCambio(req.session.userId, 'ejercicio', info.lastInsertRowid, 'crear', `Creó el ejercicio "${b.titulo}"`);
    sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
  });

  // Editar ejercicio
  router.put('/api/admin/ejercicios/:id', async (req, res, params, body, files) => {
    if (!soloLogopeda(req, res)) return;
    const existente = db.prepare('SELECT * FROM ejercicios WHERE id = ?').get(params.id);
    if (!existente) return sendJson(res, 404, { error: 'Ejercicio no encontrado' });
    const b = body || {};
    const f = files || {};

    db.prepare(`
      UPDATE ejercicios SET
        categoria = ?, titulo = ?, descripcion = ?, orden = ?,
        video_url = ?, video_archivo = ?,
        imagen_url = ?, imagen_archivo = ?,
        actualizado_por = ?, actualizado_en = datetime('now')
      WHERE id = ?
    `).run(
      b.categoria || existente.categoria,
      b.titulo || existente.titulo,
      b.descripcion !== undefined ? b.descripcion : existente.descripcion,
      b.orden !== undefined ? Number(b.orden) : existente.orden,
      b.video_url !== undefined ? b.video_url : existente.video_url,
      f.video_archivo || existente.video_archivo,
      b.imagen_url !== undefined ? b.imagen_url : existente.imagen_url,
      f.imagen_archivo || existente.imagen_archivo,
      req.session.userId,
      params.id
    );
    registrarCambio(req.session.userId, 'ejercicio', params.id, 'editar', `Editó el ejercicio "${b.titulo || existente.titulo}"`);
    sendJson(res, 200, { ok: true });
  });

  // Activar / desactivar ejercicio (los padres solo ven los activos)
  router.put('/api/admin/ejercicios/:id/estado', async (req, res, params, body) => {
    if (!soloLogopeda(req, res)) return;
    const existente = db.prepare('SELECT * FROM ejercicios WHERE id = ?').get(params.id);
    if (!existente) return sendJson(res, 404, { error: 'Ejercicio no encontrado' });
    const activo = body && body.activo ? 1 : 0;
    db.prepare("UPDATE ejercicios SET activo = ?, actualizado_por = ?, actualizado_en = datetime('now') WHERE id = ?")
      .run(activo, req.session.userId, params.id);
    registrarCambio(req.session.userId, 'ejercicio', params.id, activo ? 'activar' : 'desactivar', `"${existente.titulo}"`);
    sendJson(res, 200, { ok: true });
  });

  // Listar TODOS los ejercicios (incluye inactivos) para el panel del logopeda
  router.get('/api/admin/ejercicios', async (req, res) => {
    if (!soloLogopeda(req, res)) return;
    const rows = db.prepare('SELECT * FROM ejercicios ORDER BY categoria, orden').all();
    sendJson(res, 200, { ejercicios: rows });
  });

  // -------------------------------------------------------------------
  // FOLLETO
  // -------------------------------------------------------------------

  router.post('/api/admin/folleto', async (req, res, params, body, files) => {
    if (!soloLogopeda(req, res)) return;
    const b = body || {};
    const f = files || {};
    if (!b.titulo || !b.contenido) {
      return sendJson(res, 400, { error: 'Título y contenido son obligatorios' });
    }
    const maxOrden = db.prepare('SELECT MAX(orden) AS m FROM folleto_temas').get().m || 0;
    const info = db.prepare(`
      INSERT INTO folleto_temas (orden, titulo, contenido, imagen_url, imagen_archivo, video_url, video_archivo, activo, creado_por, actualizado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      b.orden ? Number(b.orden) : maxOrden + 1,
      b.titulo, b.contenido,
      b.imagen_url || null, f.imagen_archivo || null,
      b.video_url || null, f.video_archivo || null,
      req.session.userId, req.session.userId
    );
    registrarCambio(req.session.userId, 'folleto_tema', info.lastInsertRowid, 'crear', `Creó el tema "${b.titulo}"`);
    sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
  });

  router.put('/api/admin/folleto/:id', async (req, res, params, body, files) => {
    if (!soloLogopeda(req, res)) return;
    const existente = db.prepare('SELECT * FROM folleto_temas WHERE id = ?').get(params.id);
    if (!existente) return sendJson(res, 404, { error: 'Tema no encontrado' });
    const b = body || {};
    const f = files || {};

    db.prepare(`
      UPDATE folleto_temas SET
        titulo = ?, contenido = ?, orden = ?,
        imagen_url = ?, imagen_archivo = ?,
        video_url = ?, video_archivo = ?,
        actualizado_por = ?, actualizado_en = datetime('now')
      WHERE id = ?
    `).run(
      b.titulo || existente.titulo,
      b.contenido || existente.contenido,
      b.orden !== undefined ? Number(b.orden) : existente.orden,
      b.imagen_url !== undefined ? b.imagen_url : existente.imagen_url,
      f.imagen_archivo || existente.imagen_archivo,
      b.video_url !== undefined ? b.video_url : existente.video_url,
      f.video_archivo || existente.video_archivo,
      req.session.userId,
      params.id
    );
    registrarCambio(req.session.userId, 'folleto_tema', params.id, 'editar', `Editó el tema "${b.titulo || existente.titulo}"`);
    sendJson(res, 200, { ok: true });
  });

  router.put('/api/admin/folleto/:id/estado', async (req, res, params, body) => {
    if (!soloLogopeda(req, res)) return;
    const existente = db.prepare('SELECT * FROM folleto_temas WHERE id = ?').get(params.id);
    if (!existente) return sendJson(res, 404, { error: 'Tema no encontrado' });
    const activo = body && body.activo ? 1 : 0;
    db.prepare("UPDATE folleto_temas SET activo = ?, actualizado_por = ?, actualizado_en = datetime('now') WHERE id = ?")
      .run(activo, req.session.userId, params.id);
    registrarCambio(req.session.userId, 'folleto_tema', params.id, activo ? 'activar' : 'desactivar', `"${existente.titulo}"`);
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/admin/folleto', async (req, res) => {
    if (!soloLogopeda(req, res)) return;
    const rows = db.prepare('SELECT * FROM folleto_temas ORDER BY orden').all();
    sendJson(res, 200, { temas: rows });
  });

  // -------------------------------------------------------------------
  // HISTORIAL DE CAMBIOS DE CONTENIDO (auditoría)
  // -------------------------------------------------------------------
  router.get('/api/admin/historial-cambios', async (req, res) => {
    if (!soloLogopeda(req, res)) return;
    const rows = db.prepare(`
      SELECT h.*, u.nombre AS logopeda_nombre
      FROM historial_cambios_contenido h
      JOIN usuarios u ON u.id = h.logopeda_id
      ORDER BY h.creado_en DESC
      LIMIT 200
    `).all();
    sendJson(res, 200, { historial: rows });
  });
}

module.exports = { register };
