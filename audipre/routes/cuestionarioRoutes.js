// routes/cuestionarioRoutes.js
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');
const { checkAccessToNino } = require('./ninosRoutes');

function register(router) {
  // Guardar cuestionario (Anexo 2 de la tesis) para un niño
  router.post('/api/ninos/:id/cuestionario', async (req, res, params, body) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });

    const b = body;
    const info = db.prepare(`
      INSERT INTO cuestionarios (
        nino_id, grado_escolaridad, conocia_implante_antes, conocia_rol_familia,
        conoce_rehabilitar_antes, conoce_cuidar_despues, cree_integracion_total,
        rehabilitacion_recibida, via_educacion, frecuencia_semanal_educacion, horas_educacion,
        via_salud, frecuencia_semanal_salud, horas_salud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      b.grado_escolaridad || null,
      b.conocia_implante_antes ? 1 : 0,
      b.conocia_rol_familia ? 1 : 0,
      b.conoce_rehabilitar_antes ? 1 : 0,
      b.conoce_cuidar_despues ? 1 : 0,
      b.cree_integracion_total ? 1 : 0,
      b.rehabilitacion_recibida ? 1 : 0,
      b.via_educacion ? 1 : 0,
      b.frecuencia_semanal_educacion || null,
      b.horas_educacion || null,
      b.via_salud ? 1 : 0,
      b.frecuencia_semanal_salud || null,
      b.horas_salud || null
    );
    sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
  });

  // Ver cuestionarios de un niño (histórico)
  router.get('/api/ninos/:id/cuestionario', async (req, res, params) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });
    const rows = db.prepare('SELECT * FROM cuestionarios WHERE nino_id = ? ORDER BY creado_en DESC').all(params.id);
    sendJson(res, 200, { cuestionarios: rows });
  });
}

module.exports = { register };
