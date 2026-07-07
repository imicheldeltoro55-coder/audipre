// routes/statsRoutes.js
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');

function register(router) {
  router.get('/api/stats/resumen', async (req, res) => {
    if (!req.session || req.session.rol !== 'logopeda') return sendJson(res, 403, { error: 'Solo logopedas' });

    const ninos = db.prepare('SELECT * FROM ninos WHERE logopeda_id = ?').all(req.session.userId);
    const ninoIds = ninos.map(n => n.id);

    if (ninoIds.length === 0) {
      return sendJson(res, 200, {
        total_ninos: 0, por_sexo: {}, por_grado_hipoacusia: {}, por_modo_comunicacion: {}, cumplimiento_promedio: 0,
      });
    }

    const porSexo = {};
    const porGrado = {};
    const porModo = {};
    for (const n of ninos) {
      if (n.sexo) porSexo[n.sexo] = (porSexo[n.sexo] || 0) + 1;
      if (n.grado_hipoacusia) porGrado[n.grado_hipoacusia] = (porGrado[n.grado_hipoacusia] || 0) + 1;
      if (n.modo_comunicacion) porModo[n.modo_comunicacion] = (porModo[n.modo_comunicacion] || 0) + 1;
    }

    const placeholders = ninoIds.map(() => '?').join(',');
    const sesiones = db.prepare(`SELECT * FROM sesiones WHERE nino_id IN (${placeholders})`).all(...ninoIds);
    const puntaje = { total: 1, parcial: 0.6, pocas_veces: 0.3, nunca: 0 };
    const cumplimientoPromedio = sesiones.length
      ? Math.round((sesiones.reduce((acc, s) => acc + (puntaje[s.cumplimiento] ?? 0), 0) / sesiones.length) * 100)
      : 0;

    sendJson(res, 200, {
      total_ninos: ninos.length,
      por_sexo: porSexo,
      por_grado_hipoacusia: porGrado,
      por_modo_comunicacion: porModo,
      cumplimiento_promedio: cumplimientoPromedio,
    });
  });
}

module.exports = { register };
