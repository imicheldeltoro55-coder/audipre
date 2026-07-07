// middleware/multipart.js
// Parser minimalista de 'multipart/form-data' sin dependencias externas.
// Suficiente para formularios con campos de texto + 0-2 archivos (imagen/video).
'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// En hosting con disco persistente, UPLOADS_DIR puede apuntar al volumen
// montado (ej. /data/uploads). En local, usa la carpeta pública de siempre.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_UPLOAD_BYTES = 80 * 1024 * 1024; // 80MB, suficiente para videos cortos

const EXT_PERMITIDAS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.mov', '.m4v',
]);

function isMultipart(req) {
  const ct = req.headers['content-type'] || '';
  return ct.startsWith('multipart/form-data');
}

function getBoundary(req) {
  const ct = req.headers['content-type'] || '';
  const match = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!match) return null;
  return match[1] || match[2];
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        reject(new Error('Archivo demasiado grande (máximo 80MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Divide el buffer completo por el boundary y separa cada "parte" en
// headers crudos + contenido binario.
function splitParts(buffer, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuf);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (next === -1) break;
    let chunk = buffer.slice(start + boundaryBuf.length, next);
    // quita CRLF inicial/final propios del formato multipart
    if (chunk.slice(0, 2).toString() === '\r\n') chunk = chunk.slice(2);
    if (chunk.slice(-2).toString() === '\r\n') chunk = chunk.slice(0, -2);
    if (chunk.length > 0) parts.push(chunk);
    start = next;
  }
  return parts;
}

function parsePart(chunk) {
  const headerEnd = chunk.indexOf('\r\n\r\n');
  if (headerEnd === -1) return null;
  const headerText = chunk.slice(0, headerEnd).toString('utf8');
  const content = chunk.slice(headerEnd + 4);

  const dispositionMatch = headerText.match(/name="([^"]+)"(?:; filename="([^"]*)")?/);
  if (!dispositionMatch) return null;
  const name = dispositionMatch[1];
  const filename = dispositionMatch[2];

  const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
  const contentType = typeMatch ? typeMatch[1].trim() : null;

  return { name, filename, contentType, content };
}

// Guarda un archivo subido en disco con nombre único; retorna la ruta pública.
function guardarArchivo(part) {
  if (!part.filename) return null;
  const ext = path.extname(part.filename).toLowerCase();
  if (!EXT_PERMITIDAS.has(ext)) {
    throw new Error(`Tipo de archivo no permitido: ${ext}`);
  }
  const nombreUnico = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const destino = path.join(UPLOADS_DIR, nombreUnico);
  fs.writeFileSync(destino, part.content);
  return `/uploads/${nombreUnico}`;
}

// Procesa el request completo: retorna { fields: {...}, files: { campoName: '/uploads/xxx' } }
async function parseMultipart(req) {
  const boundary = getBoundary(req);
  if (!boundary) throw new Error('No se encontró boundary en el content-type');
  const buffer = await readRawBody(req);
  const parts = splitParts(buffer, boundary);

  const fields = {};
  const files = {};

  for (const chunk of parts) {
    const part = parsePart(chunk);
    if (!part) continue;
    if (part.filename !== undefined && part.filename !== '') {
      const rutaPublica = guardarArchivo(part);
      if (rutaPublica) files[part.name] = rutaPublica;
    } else if (part.filename === undefined) {
      fields[part.name] = part.content.toString('utf8');
    }
    // filename === '' significa "campo de archivo vacío" -> se ignora
  }

  return { fields, files };
}

module.exports = { isMultipart, parseMultipart, UPLOADS_DIR };
