// router.js
// Un router minimalista sobre 'http' nativo. Soporta métodos, params (:id)
// y parseo de JSON body. Diseñado para no requerir 'npm install'.
'use strict';

const { URL } = require('url');

class Router {
  constructor() {
    this.routes = []; // { method, pattern, keys, handler }
  }

  _register(method, path, handler) {
    const keys = [];
    const regexStr = path
      .replace(/\/:([^/]+)/g, (_, key) => {
        keys.push(key);
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/');
    const pattern = new RegExp(`^${regexStr}$`);
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path, handler) { this._register('GET', path, handler); }
  post(path, handler) { this._register('POST', path, handler); }
  put(path, handler) { this._register('PUT', path, handler); }
  delete(path, handler) { this._register('DELETE', path, handler); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(pathname);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'DELETE') return resolve({});
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // 5MB límite
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({}); // body no-JSON (ej. formularios simples) -> objeto vacío
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push('Path=/');
  parts.push('HttpOnly');
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  const existing = res.getHeader('Set-Cookie');
  const cookieStr = parts.join('; ');
  if (existing) {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0`);
}

module.exports = { Router, readJsonBody, sendJson, setCookie, clearCookie, URL };
