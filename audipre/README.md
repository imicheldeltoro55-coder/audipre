# AudiPre

Plataforma web para el seguimiento del entrenamiento auditivo pre-implante
coclear, basada en la tesis *"Propuesta de actividades para la preparación
de padres o tutor de niños hipoacúsicos, en el entrenamiento auditivo
pre-implante coclear. Complejo Borrás-Marfán"* (Dra. Daylié Michel Legrá,
2020).

## Qué incluye

- **Dos roles:** padre/tutor y logopeda.
- **Folleto informativo** (Anexo 3 de la tesis): 10 temas de orientación.
- **Guía de ejercicios** (Anexo 4): 6 categorías — percepción de sonidos,
  percepción gestual, atención, memoria visual/auditiva, praxis buco-facial
  y estimulación del lenguaje.
- **Cuestionario inicial de conocimiento** (basado en el Anexo 2).
- **Registro diario de sesiones en casa** con nivel de cumplimiento
  (total / parcial / pocas veces / nunca), duración y notas.
- **Progreso del niño:** racha de días, % de cumplimiento, historial.
- **Panel del logopeda:** lista de niños, estadísticas agregadas (por sexo,
  grado de hipoacusia, modo de comunicación) y **alertas automáticas**
  cuando una familia registra bajo cumplimiento repetidamente.
- **Gestión de contenido (solo logopeda):** el logopeda puede crear, editar,
  activar/desactivar los ejercicios de la guía y los temas del folleto,
  subiendo imágenes/videos reales desde su PC o pegando un link externo
  (YouTube, Drive, etc.). Los padres solo pueden consultar el contenido
  activo; no pueden modificarlo.
- **Auditoría:** un historial registra qué logopeda hizo qué cambio de
  contenido y cuándo, y otro historial separado registra qué niños ha
  tenido asignados cada logopeda a lo largo del tiempo.

## Requisitos

- **Node.js 22 o superior** (usa el módulo nativo `node:sqlite`, así que
  **no necesitas instalar nada con `npm install`** — no hay dependencias
  externas: ni Express, ni bcrypt, ni better-sqlite3).

Para comprobar tu versión de Node en Windows (PowerShell o CMD):

```
node --version
```

Si tienes una versión menor a 22, descarga la más reciente desde
https://nodejs.org.

## Cómo ejecutarlo (Windows)

1. Copia toda la carpeta `audipre` a tu PC (por ejemplo a
   `C:\Users\TuUsuario\Proyectos\audipre`).
2. Abre una terminal (PowerShell) dentro de esa carpeta.
3. Ejecuta:

   ```
   node server.js
   ```

4. Verás el mensaje: `AudiPre corriendo en http://localhost:3000`
5. Abre esa URL en tu navegador.

La primera vez que arranca, crea automáticamente el archivo
`db/audipre.db` (SQLite) con el folleto y los ejercicios ya cargados.

## Estructura del proyecto

```
audipre/
├── server.js              Punto de entrada (servidor HTTP nativo)
├── router.js               Mini router (reemplaza Express)
├── db/
│   ├── database.js         Esquema SQLite + datos iniciales (seed)
│   └── audipre.db          Se crea al ejecutar (no se sube a git)
├── middleware/
│   └── auth.js             Hash de contraseñas + sesiones
├── routes/
│   ├── authRoutes.js        Registro / login / logout
│   ├── ninosRoutes.js        CRUD de niños
│   ├── cuestionarioRoutes.js Cuestionario de conocimiento
│   ├── contenidoRoutes.js    Folleto y catálogo de ejercicios
│   ├── sesionesRoutes.js     Sesiones diarias + alertas
│   └── statsRoutes.js        Estadísticas agregadas
└── public/                  Frontend (HTML/CSS/JS puro, sin frameworks)
    ├── index.html, login.html, registro.html
    ├── padre/                Vistas del padre/tutor
    └── logopeda/             Vistas del logopeda
```

## Por qué sin dependencias externas

Node 22 incluye SQLite de forma nativa (`node:sqlite`), y el servidor está
escrito sobre el módulo `http` nativo. Esto evita por completo los
problemas de `npm install`, políticas de ejecución de PowerShell o rutas
de `node_modules` que ya se han dado en proyectos anteriores en Windows.
Solo necesitas Node instalado; nada más.

## Cómo compartir la app con un link público

Ejecutar `node server.js` en tu PC solo sirve para pruebas locales — el
link deja de funcionar en cuanto apagas la máquina. Para que familias y
logopedas usen la app de verdad, sigue la guía **`DESPLIEGUE.md`** incluida
en este proyecto, que explica paso a paso cómo publicarla en Railway con
un link permanente.

## Próximos pasos posibles

- Subir videos/imágenes reales a los ejercicios (`video_url`, `imagen_url`
  ya están en el esquema, listos para usarse).
- Exportar reportes en PDF del progreso de un niño para el expediente.
- Notificaciones por correo al logopeda cuando se genera una alerta.
- Panel de administración para reasignar niños entre logopedas.
