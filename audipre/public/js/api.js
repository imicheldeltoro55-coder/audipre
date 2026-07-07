// public/js/api.js
// Cliente pequeño para hablar con la API. Sin dependencias (fetch nativo).

const Api = {
  async _req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body); },
  put(url, body) { return this._req('PUT', url, body); },
  delete(url) { return this._req('DELETE', url); },

  // Envía un <form> (o FormData) con posibles archivos adjuntos.
  async postForm(url, formData, method) {
    const res = await fetch(url, {
      method: method || 'POST',
      credentials: 'same-origin',
      body: formData, // el navegador pone el Content-Type multipart correcto solo
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },
};

// Obtiene la sesión actual; si no hay, redirige a login (usar en páginas protegidas)
async function requireSession() {
  try {
    const { user } = await Api.get('/api/auth/me');
    return user;
  } catch (e) {
    window.location.href = '/login.html';
    return null;
  }
}

function mostrarError(contenedor, mensaje) {
  contenedor.textContent = mensaje;
  contenedor.className = 'mensaje-error';
  contenedor.classList.remove('oculto');
}

function mostrarExito(contenedor, mensaje) {
  contenedor.textContent = mensaje;
  contenedor.className = 'mensaje-exito';
  contenedor.classList.remove('oculto');
}

const ETIQUETAS_CATEGORIA = {
  percepcion_sonidos: 'Percepción de sonidos',
  percepcion_gestual: 'Percepción gestual',
  atencion: 'Ejercicios para la atención',
  memoria: 'Memoria visual y auditiva',
  praxis_bucofacial: 'Praxis buco-facial',
  lenguaje: 'Estimulación del lenguaje',
};
