// routes/sesionesRoutes.js
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');
const { checkAccessToNino } = require('./ninosRoutes');

// Genera una alerta para el logopeda si el cumplimiento reciente es bajo.
// Regla simple derivada de la tesis: si de las últimas 5 sesiones registradas
// la mayoría son "pocas_veces" o "nunca", se alerta al profesional.
function evaluarAlertas(ninoId) {
  const ultimas = db.prepare(
    'SELECT cumplimiento FROM sesiones WHERE nino_id = ? ORDER BY fecha DESC LIMIT 5'
  ).all(ninoId);
  if (ultimas.length < 3) return;
  const bajas = ultimas.filter(s => s.cumplimiento === 'pocas_veces' || s.cumplimiento === 'nunca').length;
  if (bajas >= 3) {
    const yaExiste = db.prepare(
      "SELECT id FROM alertas WHERE nino_id = ? AND atendida = 0 AND mensaje LIKE '%cumplimiento bajo%'"
    ).get(ninoId);
    if (!yaExiste) {
      db.prepare('INSERT INTO alertas (nino_id, mensaje) VALUES (?, ?)').run(
        ninoId,
        'Cumplimiento bajo detectado: la familia registró pocas veces o nunca en sus últimas sesiones. Se recomienda contactar y reforzar orientación.'
      );
    }
  }
}

function register(router) {
  // Registrar una sesión de rehabilitación en casa
  router.post('/api/ninos/:id/sesiones', async (req, res, params, body) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });

    const { fecha, duracion_min, cumplimiento, notas, ejercicios_ids } = body;
    if (!fecha || !cumplimiento) return sendJson(res, 400, { error: 'Fecha y cumplimiento son obligatorios' });
    if (!['total', 'parcial', 'pocas_veces', 'nunca'].includes(cumplimiento)) {
      return sendJson(res, 400, { error: 'Valor de cumplimiento inválido' });
    }

    const info = db.prepare(`
      INSERT INTO sesiones (nino_id, fecha, duracion_min, cumplimiento, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.id, fecha, duracion_min || null, cumplimiento, notas || null);

    const sesionId = info.lastInsertRowid;
    if (Array.isArray(ejercicios_ids)) {
      const insertRel = db.prepare('INSERT OR IGNORE INTO sesion_ejercicios (sesion_id, ejercicio_id, completado) VALUES (?, ?, 1)');
      for (const ejId of ejercicios_ids) insertRel.run(sesionId, ejId);
    }

    evaluarAlertas(params.id);
    sendJson(res, 201, { ok: true, id: sesionId });
  });

  // Listar sesiones de un niño
  router.get('/api/ninos/:id/sesiones', async (req, res, params) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });
    const rows = db.prepare('SELECT * FROM sesiones WHERE nino_id = ? ORDER BY fecha DESC').all(params.id);
    sendJson(res, 200, { sesiones: rows });
  });

  // Resumen / progreso de un niño: racha de días, % cumplimiento total, por categoría
  router.get('/api/ninos/:id/progreso', async (req, res, params) => {
    if (!req.session) return sendJson(res, 401, { error: 'No autenticado' });
    const nino = db.prepare('SELECT * FROM ninos WHERE id = ?').get(params.id);
    if (!checkAccessToNino(req.session, nino)) return sendJson(res, 403, { error: 'No autorizado' });

    const sesiones = db.prepare('SELECT * FROM sesiones WHERE nino_id = ? ORDER BY fecha DESC').all(params.id);
    const total = sesiones.length;
    const puntaje = { total: 1, parcial: 0.6, pocas_veces: 0.3, nunca: 0 };
    const pctCumplimiento = total
      ? Math.round((sesiones.reduce((acc, s) => acc + (puntaje[s.cumplimiento] ?? 0), 0) / total) * 100)
      : 0;

    // Racha de días consecutivos con al menos cumplimiento parcial, contando desde hoy hacia atrás
    let racha = 0;
    const fechasCumplidas = new Set(
      sesiones.filter(s => s.cumplimiento === 'total' || s.cumplimiento === 'parcial').map(s => s.fecha)
    );
    let cursor = new Date();
    for (;;) {
      const iso = cursor.toISOString().slice(0, 10);
      if (fechasCumplidas.has(iso)) {
        racha++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    sendJson(res, 200, {
      total_sesiones: total,
      porcentaje_cumplimiento: pctCumplimiento,
      racha_dias: racha,
      ultimas_sesiones: sesiones.slice(0, 10),
    });
  });

  // Alertas para el logopeda
  router.get('/api/alertas', async (req, res) => {
    if (!req.session || req.session.rol !== 'logopeda') return sendJson(res, 403, { error: 'Solo logopedas' });
    const rows = db.prepare(`
      SELECT a.*, n.nombre AS nino_nombre
      FROM alertas a JOIN ninos n ON n.id = a.nino_id
      WHERE n.logopeda_id = ? AND a.atendida = 0
      ORDER BY a.creado_en DESC
    `).all(req.session.userId);
    sendJson(res, 200, { alertas: rows });
  });

  router.put('/api/alertas/:id/atender', async (req, res, params) => {
    if (!req.session || req.session.rol !== 'logopeda') return sendJson(res, 403, { error: 'Solo logopedas' });
    db.prepare('UPDATE alertas SET atendida = 1 WHERE id = ?').run(params.id);
    sendJson(res, 200, { ok: true });
  });
}

module.exports = { register };
