// db/database.js
// Capa de acceso a datos usando node:sqlite (nativo desde Node 22, no requiere npm install)
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// En hosting con disco persistente (ej. Railway), DB_DIR apunta al volumen
// montado (ej. /data). En local, usa esta misma carpeta de siempre.
const DB_DIR = process.env.DB_DIR || __dirname;
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'audipre.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------------------
// ESQUEMA
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('padre', 'logopeda', 'admin')),
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ninos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre              TEXT NOT NULL,
  edad                INTEGER,
  sexo                TEXT CHECK (sexo IN ('M', 'F')),
  grado_hipoacusia    TEXT,              -- superficial | moderada | severa | profunda
  modo_comunicacion   TEXT,              -- pre-verbal | bimodal | oral | señas
  usa_protesis        INTEGER DEFAULT 0, -- 0/1
  horas_protesis_dia  REAL,
  etapa               TEXT DEFAULT 'pre-implante', -- pre-implante | post-implante
  logopeda_id         INTEGER REFERENCES usuarios(id),
  padre_id            INTEGER REFERENCES usuarios(id),
  creado_en           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cuestionario inicial de conocimiento de los padres (Anexo 2 de la tesis)
CREATE TABLE IF NOT EXISTS cuestionarios (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id                     INTEGER NOT NULL REFERENCES ninos(id),
  grado_escolaridad           TEXT,   -- primaria | secundaria | media | superior
  conocia_implante_antes      INTEGER,
  conocia_rol_familia         INTEGER,
  conoce_rehabilitar_antes    INTEGER,
  conoce_cuidar_despues       INTEGER,
  cree_integracion_total      INTEGER,
  rehabilitacion_recibida     INTEGER,
  via_educacion                INTEGER DEFAULT 0,
  frecuencia_semanal_educacion INTEGER,
  horas_educacion              REAL,
  via_salud                    INTEGER DEFAULT 0,
  frecuencia_semanal_salud     INTEGER,
  horas_salud                  REAL,
  creado_en                   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo de ejercicios de la guía de instrucción (Anexo 4)
CREATE TABLE IF NOT EXISTS ejercicios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria     TEXT NOT NULL, -- percepcion_sonidos | percepcion_gestual | atencion | memoria | praxis_bucofacial | lenguaje
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  video_url     TEXT,        -- link externo (YouTube, Drive, etc.)
  video_archivo TEXT,        -- ruta de archivo subido (/uploads/xxx.mp4)
  imagen_url    TEXT,        -- link externo
  imagen_archivo TEXT,       -- ruta de archivo subido (/uploads/xxx.jpg)
  orden         INTEGER DEFAULT 0,
  activo        INTEGER DEFAULT 1,
  creado_por    INTEGER REFERENCES usuarios(id),
  actualizado_por INTEGER REFERENCES usuarios(id),
  actualizado_en  TEXT DEFAULT (datetime('now'))
);

-- Registro diario de rehabilitación en casa (lo que hace el padre)
CREATE TABLE IF NOT EXISTS sesiones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id       INTEGER NOT NULL REFERENCES ninos(id),
  fecha         TEXT NOT NULL, -- YYYY-MM-DD
  duracion_min  INTEGER,
  cumplimiento  TEXT CHECK (cumplimiento IN ('total','parcial','pocas_veces','nunca')),
  notas         TEXT,
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Relación N:N entre sesión y ejercicios realizados en esa sesión
CREATE TABLE IF NOT EXISTS sesion_ejercicios (
  sesion_id     INTEGER NOT NULL REFERENCES sesiones(id),
  ejercicio_id  INTEGER NOT NULL REFERENCES ejercicios(id),
  completado    INTEGER DEFAULT 1,
  PRIMARY KEY (sesion_id, ejercicio_id)
);

-- Temas del folleto informativo (Anexo 3)
CREATE TABLE IF NOT EXISTS folleto_temas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  orden         INTEGER NOT NULL,
  titulo        TEXT NOT NULL,
  contenido     TEXT NOT NULL,
  imagen_url      TEXT,
  imagen_archivo  TEXT,
  video_url       TEXT,
  video_archivo   TEXT,
  activo          INTEGER DEFAULT 1,
  creado_por      INTEGER REFERENCES usuarios(id),
  actualizado_por INTEGER REFERENCES usuarios(id),
  actualizado_en  TEXT DEFAULT (datetime('now'))
);

-- Auditoría: historial de cambios que hace un logopeda sobre el contenido
-- (ejercicios y temas del folleto). Se guarda en cada crear/editar/desactivar.
CREATE TABLE IF NOT EXISTS historial_cambios_contenido (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  logopeda_id   INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_contenido TEXT NOT NULL CHECK (tipo_contenido IN ('ejercicio', 'folleto_tema')),
  contenido_id  INTEGER NOT NULL,
  accion        TEXT NOT NULL CHECK (accion IN ('crear', 'editar', 'activar', 'desactivar')),
  detalle       TEXT, -- descripción legible de qué cambió
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historial de asignación de niños a logopedas a lo largo del tiempo
-- (se registra cada vez que un niño se asigna o desasigna de un logopeda)
CREATE TABLE IF NOT EXISTS historial_asignaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id       INTEGER NOT NULL REFERENCES ninos(id),
  logopeda_id   INTEGER NOT NULL REFERENCES usuarios(id),
  accion        TEXT NOT NULL CHECK (accion IN ('asignado', 'desasignado')),
  creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alertas generadas para el logopeda cuando el cumplimiento es bajo
CREATE TABLE IF NOT EXISTS alertas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nino_id     INTEGER NOT NULL REFERENCES ninos(id),
  mensaje     TEXT NOT NULL,
  atendida    INTEGER DEFAULT 0,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---------------------------------------------------------------------------
// SEED: datos iniciales (folleto + ejercicios) tomados de la tesis
// ---------------------------------------------------------------------------
function seedIfEmpty() {
  const countFolleto = db.prepare('SELECT COUNT(*) AS c FROM folleto_temas').get().c;
  if (countFolleto === 0) {
    const temas = [
      ['La comunicación y los problemas de la audición', 'La pérdida auditiva afecta la forma en que el niño recibe información del mundo, pero no impide que se comunique. Existen múltiples vías para lograrlo.'],
      ['Por qué la comunicación es importante', 'La comunicación temprana es la base del desarrollo emocional, social y cognitivo del niño. Cuanto antes se estimule, mejor será su desarrollo integral.'],
      ['Cómo los niños desarrollan nuevas habilidades', 'Los niños aprenden por repetición, imitación y refuerzo positivo. El juego es su principal vía de aprendizaje.'],
      ['Los niños sordos necesitan ayuda temprana', 'La estimulación auditiva antes de los 18 meses es crítica para el desarrollo del lenguaje. Cuanto antes se actúe, mejor pronóstico.'],
      ['Implante coclear (IC)', 'Es un dispositivo electrónico que sustituye la función de las células dañadas del oído interno, permitiendo la percepción de sonidos.'],
      ['¿Cómo funciona?', 'El IC capta el sonido, lo transforma en señal eléctrica y estimula directamente el nervio auditivo, evitando las estructuras dañadas del oído.'],
      ['Riesgos de la cirugía', 'Como toda cirugía, conlleva riesgos anestésicos y quirúrgicos que el equipo médico evaluará y explicará antes del procedimiento.'],
      ['Utilización del dispositivo después de la cirugía', 'El implante se activa semanas después de la cirugía. A partir de ahí comienza el proceso de programación y adaptación.'],
      ['Adaptación al implante coclear', 'El cerebro necesita tiempo para aprender a interpretar las nuevas señales auditivas. La rehabilitación continua es esencial.'],
      ['Cuidados del implante coclear', 'Se debe proteger el dispositivo de golpes, humedad y estática. Revisar diariamente que el procesador externo funcione correctamente.'],
    ];
    const insert = db.prepare('INSERT INTO folleto_temas (orden, titulo, contenido) VALUES (?, ?, ?)');
    temas.forEach((t, i) => insert.run(i + 1, t[0], t[1]));
  }

  const countEj = db.prepare('SELECT COUNT(*) AS c FROM ejercicios').get().c;
  if (countEj === 0) {
    const ejercicios = [
      ['percepcion_sonidos', 'Estimulación a través del sonido', 'Presentar al niño distintos sonidos del entorno (palmadas, campana, voz) y observar su reacción.', 1],
      ['percepcion_sonidos', 'Percepción del sonido con apoyo de juegos', 'Usar juguetes sonoros para que el niño asocie el sonido con una acción o un juego.', 2],
      ['percepcion_gestual', 'Expresar mucho o poco con gestos', 'Enseñar al niño a usar gestos para expresar cantidad (mucho/poco), como base de comunicación no verbal.', 1],
      ['atencion', 'Seguir objetos con la mirada', 'Mover un objeto llamativo frente al niño para que lo siga visualmente, estimulando la atención sostenida.', 1],
      ['atencion', 'Rompecabezas', 'Armar rompecabezas simples acordes a la edad del niño para fomentar concentración y resolución de problemas.', 2],
      ['memoria', 'Juegos de relaciones', 'Relacionar objetos o imágenes que tengan conexión entre sí (ej. paraguas - lluvia).', 1],
      ['memoria', 'Clasificar semejantes y opuestos', 'Agrupar objetos o imágenes según semejanzas o diferencias (grande/pequeño, igual/distinto).', 2],
      ['memoria', 'Asociación de imágenes', 'Emparejar imágenes iguales o relacionadas para estimular la memoria visual.', 3],
      ['praxis_bucofacial', 'Expresiones faciales', 'Imitar expresiones faciales (sonreír, sorpresa, enojo) frente a un espejo junto al niño.', 1],
      ['praxis_bucofacial', 'Ejercicios de labios, mejillas y lengua', 'Ejercicios de soplo, inflar mejillas, mover la lengua, para fortalecer la musculatura orofacial.', 2],
      ['lenguaje', 'Esquemas corporales', 'Nombrar y señalar partes del cuerpo propio y del niño para asociar palabra-concepto.', 1],
      ['lenguaje', 'Coordinación', 'Actividades que combinen movimiento y lenguaje simple (ej. "salta" mientras salta).', 2],
      ['lenguaje', 'Vocalizaciones', 'Estimular al niño a emitir sonidos vocálicos simples imitando al adulto.', 3],
      ['lenguaje', 'Sonidos onomatopéyicos (sonidos de animales)', 'Imitar sonidos de animales conocidos para asociar sonido con imagen/concepto.', 4],
    ];
    const insert = db.prepare('INSERT INTO ejercicios (categoria, titulo, descripcion, orden) VALUES (?, ?, ?, ?)');
    ejercicios.forEach(e => insert.run(e[0], e[1], e[2], e[3]));
  }
}

seedIfEmpty();

// ---------------------------------------------------------------------------
// MIGRACIONES LIGERAS: agrega columnas nuevas si la BD ya existía de antes
// (evita que pierdas los datos que ya cargaste en tu PC).
// ---------------------------------------------------------------------------
function columnaExiste(tabla, columna) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
  return cols.some(c => c.name === columna);
}

function agregarColumnaSiFalta(tabla, columna, definicion) {
  if (!columnaExiste(tabla, columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

agregarColumnaSiFalta('ejercicios', 'video_archivo', 'TEXT');
agregarColumnaSiFalta('ejercicios', 'imagen_archivo', 'TEXT');
agregarColumnaSiFalta('ejercicios', 'activo', 'INTEGER DEFAULT 1');
agregarColumnaSiFalta('ejercicios', 'creado_por', 'INTEGER');
agregarColumnaSiFalta('ejercicios', 'actualizado_por', 'INTEGER');
agregarColumnaSiFalta('ejercicios', 'actualizado_en', "TEXT DEFAULT (datetime('now'))");

agregarColumnaSiFalta('folleto_temas', 'imagen_url', 'TEXT');
agregarColumnaSiFalta('folleto_temas', 'imagen_archivo', 'TEXT');
agregarColumnaSiFalta('folleto_temas', 'video_url', 'TEXT');
agregarColumnaSiFalta('folleto_temas', 'video_archivo', 'TEXT');
agregarColumnaSiFalta('folleto_temas', 'activo', 'INTEGER DEFAULT 1');
agregarColumnaSiFalta('folleto_temas', 'creado_por', 'INTEGER');
agregarColumnaSiFalta('folleto_temas', 'actualizado_por', 'INTEGER');
agregarColumnaSiFalta('folleto_temas', 'actualizado_en', "TEXT DEFAULT (datetime('now'))");

module.exports = db;
