// routes/contenidoRoutes.js
// Contenido educativo estático derivado de la tesis: folleto (Anexo 3) y
// catálogo de ejercicios de la guía de instrucción (Anexo 4).
'use strict';

const db = require('../db/database');
const { sendJson } = require('../router');

function register(router) {
  // Solo contenido activo: lo que edita/gestiona el logopeda desde su panel.
  router.get('/api/folleto', async (req, res) => {
    const temas = db.prepare('SELECT * FROM folleto_temas WHERE activo = 1 ORDER BY orden').all();
    sendJson(res, 200, { temas });
  });

  router.get('/api/ejercicios', async (req, res) => {
    const ejercicios = db.prepare('SELECT * FROM ejercicios WHERE activo = 1 ORDER BY categoria, orden').all();
    // Agrupar por categoría para que el frontend los muestre organizados
    const categorias = {};
    for (const e of ejercicios) {
      if (!categorias[e.categoria]) categorias[e.categoria] = [];
      categorias[e.categoria].push(e);
    }
    sendJson(res, 200, { categorias });
  });
}

module.exports = { register };
