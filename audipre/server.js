// server.js
// Punto de entrada. Servidor HTTP nativo (sin Express) + router propio.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Router, readJsonBody, sendJson, URL } = require('./router');
const { sessionMiddleware } = require('./middleware/auth');
const { isMultipart, parseMultipart, UPLOADS_DIR } = require('./middleware/multipart');

const authRoutes = require('./routes/authRoutes');
const ninosRoutes = require('./routes/ninosRoutes');
const cuestionarioRoutes = require('./routes/cuestionarioRoutes');
const contenidoRoutes = require('./routes/contenidoRoutes');
const sesionesRoutes = require('./routes/sesionesRoutes');
const statsRoutes = require('./routes/statsRoutes');
const contenidoAdminRoutes = require('./routes/contenidoAdminRoutes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const router = new Router();
authRoutes.register(router);
ninosRoutes.register(router);
cuestionarioRoutes.register(router);
contenidoRoutes.register(router);
sesionesRoutes.register(router);
statsRoutes.register(router);
contenidoAdminRoutes.register(router);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
};

function serveStatic(req, res, pathname) {
  // Los archivos subidos por el logopeda pueden vivir fuera de public/
  // (en un volumen persistente), así que se sirven aparte.
  if (pathname.startsWith('/uploads/')) {
    const filename = pathname.slice('/uploads/'.length);
    const safeName = path.basename(filename); // evita path traversal
    const fullPath = path.join(UPLOADS_DIR, safeName);
    return fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('No encontrado');
      }
      const ext = path.extname(fullPath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, ''); // evitar path traversal
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Prohibido');
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    sessionMiddleware(req, res, () => {});

    if (pathname.startsWith('/api/')) {
      const match = router.match(req.method, pathname);
      if (!match) {
        return sendJson(res, 404, { error: 'Ruta no encontrada' });
      }

      if (isMultipart(req)) {
        // Formulario con archivos: fields (texto) + files (rutas ya guardadas en disco)
        const { fields, files } = await parseMultipart(req);
        await match.handler(req, res, match.params, fields, files);
      } else {
        const body = await readJsonBody(req);
        await match.handler(req, res, match.params, body);
      }
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    console.error('Error del servidor:', err);
    sendJson(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AudiPre corriendo en http://localhost:${PORT}`);
});
