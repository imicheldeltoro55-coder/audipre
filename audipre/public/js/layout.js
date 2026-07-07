// public/js/layout.js
// Inserta una topbar autenticada consistente en todas las páginas internas.

function renderTopbar(user, activeLink) {
  const base = user.rol === 'padre' ? '/padre' : '/logopeda';
  const links = user.rol === 'padre'
    ? [
        ['inicio.html', 'Mis niños'],
        ['folleto.html', 'Folleto informativo'],
      ]
    : [
        ['panel.html', 'Panel'],
        ['contenido.html', 'Contenido'],
        ['alertas.html', 'Alertas'],
        ['historial.html', 'Historial'],
      ];

  const nav = links.map(([href, label]) => {
    const activo = href === activeLink ? 'style="color: var(--tinta); font-weight:700;"' : '';
    return `<a href="${base}/${href}" class="btn btn-texto" ${activo}>${label}</a>`;
  }).join('');

  document.getElementById('topbar').outerHTML = `
    <header class="topbar" id="topbar">
      <a href="${base}/${links[0][0]}" class="marca">
        <div class="onda-marca"><span></span><span></span><span></span></div>
        <div class="marca-texto">AudiPre<small>Pre-implante coclear</small></div>
      </a>
      <div class="nav-usuario">
        ${nav}
        <span class="pill-rol">${user.rol}</span>
        <button class="btn btn-texto" id="btn-salir">Salir</button>
      </div>
    </header>
  `;

  document.getElementById('btn-salir').addEventListener('click', async () => {
    await Api.post('/api/auth/logout');
    window.location.href = '/login.html';
  });
}
