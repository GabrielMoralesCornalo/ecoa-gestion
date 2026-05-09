# ECOA Gestión — Brief para Claude Code

## Contexto
Sistema de gestión académica y administrativa para la carrera de Coaching Ontológico Profesional dictada en ECOA Corrientes. La carrera dura 2 años (Año 1: 10 meses, Año 2: 11 meses). Se espera una comisión de ~30 alumnos por cohorte. El sistema lo usan dos administradores (Gaby y Romina), un staff variable de coaches/tutores, y eventualmente múltiples comisiones en simultáneo.

---

## Stack tecnológico

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL en Supabase (free tier, 500MB, sin vencimiento). Driver: `pg` con `node-postgres`
- **Autenticación**: JWT + bcrypt
- **Imágenes de comprobantes**: almacenamiento local en `/uploads`
- **Lectura de comprobantes**: Anthropic API (claude-sonnet-4-20250514) con visión
- **Deploy**: Render.com (free tier) para el servidor Node.js + Supabase (free tier) para la base de datos PostgreSQL

**Estructura de carpetas:**
```
ecoa-gestion/
├── server/
│   ├── index.js
│   ├── db.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── attendance.js
│   │   ├── guides.js
│   │   ├── audiencias.js
│   │   ├── mediciones.js
│   │   ├── cobranza.js        # solo admin
│   │   └── coaching-observado.js
│   └── middleware/
│       ├── auth.js
│       └── adminOnly.js
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   └── vite.config.js
├── package.json
└── railway.json
```

---

## Roles y permisos

| Módulo | Admin (Gaby, Romina) | Staff (coaches/tutores) |
|---|---|---|
| Alumnos | CRUD completo | Solo lectura |
| Asistencia | CRUD completo | Cargar asistencia de sus clases |
| Guías | CRUD completo | Marcar entrega por alumno |
| Audiencias | CRUD completo | Cargar evaluaciones |
| Mediciones | CRUD completo | Solo lectura |
| Coaching Observado | CRUD completo | Cargar sus sesiones asignadas |
| Cobranza | CRUD completo | **SIN ACCESO — no visible** |
| Usuarios/Staff | CRUD completo | Solo su perfil |
| Panel de alumnos | Todos | Sus tutelados destacados, resto visible |

---

## Modelos de datos

> **Nota para Claude Code**: La base de datos es PostgreSQL (Supabase). Reemplazar `INTEGER PRIMARY KEY AUTOINCREMENT` por `SERIAL PRIMARY KEY` y `INTEGER DEFAULT 0` por `BOOLEAN DEFAULT FALSE` donde corresponda. El resto del SQL es compatible.

### Users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','staff')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Cohorts (comisiones)
```sql
CREATE TABLE cohorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,          -- ej: "Comisión 2026"
  year_started INTEGER NOT NULL,
  active INTEGER DEFAULT 1
);
```

### Students
```sql
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  career_year INTEGER DEFAULT 1 CHECK(career_year IN (1,2)),
  tutor_y1_id INTEGER REFERENCES users(id),
  tutor_y2_id INTEGER REFERENCES users(id),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Teams (equipos de audiencia)
```sql
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  name TEXT NOT NULL,
  career_year INTEGER CHECK(career_year IN (1,2)),
  from_month INTEGER,   -- mes de inicio (1-10 año1, 1-11 año2)
  to_month INTEGER,     -- mes de fin
  active INTEGER DEFAULT 1
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER REFERENCES teams(id),
  student_id INTEGER REFERENCES students(id)
);
```

### Classes y Asistencia
```sql
CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  career_year INTEGER,
  date TEXT NOT NULL,
  month_number INTEGER,
  topic TEXT,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id),
  student_id INTEGER REFERENCES students(id),
  present INTEGER DEFAULT 0,
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id),
  recorded_at TEXT DEFAULT (datetime('now'))
);
```

### Guías
```sql
CREATE TABLE guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  career_year INTEGER,
  month_number INTEGER,
  guide_number INTEGER CHECK(guide_number IN (1,2)),  -- 1 o 2 si ese mes hay dos
  title TEXT,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE guide_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id INTEGER REFERENCES guides(id),
  student_id INTEGER REFERENCES students(id),
  delivered INTEGER DEFAULT 0,
  delivery_date TEXT,
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id)
);
```

### Audiencias
```sql
-- Escala: MULTIPLICO | SUMO | IGUALO | DIVIDO | RESTO
CREATE TABLE audiencia_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER REFERENCES teams(id),
  cohort_id INTEGER REFERENCES cohorts(id),
  date TEXT NOT NULL,
  career_year INTEGER,
  month_number INTEGER,
  scale_result TEXT CHECK(scale_result IN ('MULTIPLICO','SUMO','IGUALO','DIVIDO','RESTO')),
  evaluator_id INTEGER REFERENCES users(id),
  notes TEXT
);
```
> Nota: las audiencias se evalúan por equipo, no por alumno individual. No se promedian con las notas formales, son solo seguimiento de proceso.

### Mediciones de Entendimiento
```sql
CREATE TABLE mediciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  career_year INTEGER,
  number INTEGER CHECK(number IN (1,2)),  -- 1ra o 2da medición del año
  date TEXT,
  title TEXT    -- ej: "Medición 1 — Año 1"
);

CREATE TABLE medicion_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicion_id INTEGER REFERENCES mediciones(id),
  student_id INTEGER REFERENCES students(id),
  grade REAL CHECK(grade >= 0 AND grade <= 10),
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id)
);
```

### Final Oral Integrador (fin de Año 2)
```sql
CREATE TABLE final_oral (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  date TEXT
);

CREATE TABLE final_oral_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  final_oral_id INTEGER REFERENCES final_oral(id),
  student_id INTEGER REFERENCES students(id),
  grade REAL CHECK(grade >= 0 AND grade <= 10),
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id)
);
```

---

## Módulo: Cobranza (SOLO ADMIN)

### Lógica de negocio
- Ventana de pago: días 1 al 10 de cada mes
- Pasado el día 10, se activan alertas escalonadas:

| Días de atraso | Nivel | Color sugerido |
|---|---|---|
| 1–5 (día 11–15) | 1er aviso | Amarillo |
| 6–10 (día 16–20) | 2do aviso | Naranja |
| 11–15 (día 21–25) | Aviso formal | Rojo |
| 16+ (día 26+) | Crítico | Rojo oscuro |

- El panel de alertas se muestra automáticamente al entrar al módulo si hay alumnos en mora
- Se puede registrar manualmente que se envió un recordatorio (con fecha y quién lo envió)

### Condiciones especiales por alumno
- Normal
- Beca parcial (porcentaje o monto diferencial)
- Cuota diferencial (monto fijo diferente)
- Pago bimestral (paga cada 2 meses, no mensual)

### Lector de comprobantes con IA
Flujo:
1. Admin sube imagen (screenshot de Mercado Pago, Modo, transferencia bancaria, etc.)
2. El backend envía la imagen a la Anthropic API con este prompt de sistema:
```
Sos un asistente que extrae datos de comprobantes de pago argentinos. 
Analizá la imagen y devolvé SOLO un JSON con este formato exacto, sin texto adicional:
{"payer_name": "...", "amount": 0000, "date": "YYYY-MM-DD", "source": "..."}
Si no podés determinar algún campo, usá null.
```
3. El backend hace fuzzy matching del `payer_name` contra los nombres de alumnos de la comisión activa:
   - Normalizar: lowercase, sin acentos, sin caracteres especiales
   - Match si: un nombre contiene al otro, o si hay 2+ palabras en común con longitud > 3
   - Devolver top 3 coincidencias con score
4. El frontend muestra: "¿Este pago corresponde a [Nombre Alumno]?" con opciones de confirmar o elegir otro
5. Al confirmar, se registra el pago en la tabla `payments`

### Tablas
```sql
CREATE TABLE fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  month TEXT NOT NULL,         -- formato YYYY-MM
  amount REAL NOT NULL,
  condition TEXT DEFAULT 'normal' CHECK(condition IN ('normal','beca','diferencial','bimestral')),
  condition_notes TEXT
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  month TEXT NOT NULL,
  paid_date TEXT,
  amount_paid REAL,
  method TEXT,                 -- transferencia, efectivo, mercado pago, etc.
  receipt_image_path TEXT,
  registered_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE payment_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  month TEXT NOT NULL,
  sent_date TEXT DEFAULT (datetime('now')),
  alert_level TEXT,
  sent_by INTEGER REFERENCES users(id),
  notes TEXT
);
```

---

## Módulo: Coaching Observado (Año 2, desde mes 2)

### Fase 1 — 3 meses
- Sesiones del staff/entrenadores hacia alumnos (alumno = coachee)
- Cada alumno debe pasar mínimo 2 veces como coachee
- El sistema avisa visualmente si un alumno no llegó al mínimo

```sql
CREATE TABLE co_fase1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  date TEXT NOT NULL,
  coach_id INTEGER REFERENCES users(id),     -- staff o entrenador
  student_id INTEGER REFERENCES students(id), -- alumno como coachee
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id)
);
```

### Fase 2 — 3 meses
- Sesiones entre alumnos
- Cada alumno debe actuar como coach mínimo 2 veces
- El sistema avisa si un alumno no llegó al mínimo como coach

```sql
CREATE TABLE co_fase2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id INTEGER REFERENCES cohorts(id),
  date TEXT NOT NULL,
  student_coach_id INTEGER REFERENCES students(id),
  student_coachee_id INTEGER REFERENCES students(id),
  notes TEXT,
  recorded_by INTEGER REFERENCES users(id)
);
```

### Fase 3 — Sesiones con tutor
- Cada alumno debe completar 24 sesiones en total con coachees externos
- Cada domingo se entregan 2 auto-observaciones escritas
- El primer domingo de cada mes se entrega también el video de una de las sesiones
- El tutor evalúa cada entrega con: `NO_ALCANZO | ALCANZO | ALCANZO_SATISFACTORIAMENTE | SUPERO`

```sql
CREATE TABLE co_fase3_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  session_number INTEGER,     -- 1 a 24
  date TEXT,
  coachee_name TEXT,          -- nombre del coachee externo
  notes TEXT
);

CREATE TABLE co_fase3_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  sunday_date TEXT NOT NULL,
  auto_obs_1 INTEGER DEFAULT 0,   -- 1 = entregada
  auto_obs_2 INTEGER DEFAULT 0,
  video_submitted INTEGER DEFAULT 0,  -- solo primer domingo del mes
  tutor_eval TEXT CHECK(tutor_eval IN ('NO_ALCANZO','ALCANZO','ALCANZO_SATISFACTORIAMENTE','SUPERO')),
  tutor_id INTEGER REFERENCES users(id),
  eval_date TEXT,
  notes TEXT
);
```

---

## Pantallas principales

### Login
- Email + contraseña
- El sistema redirige según rol: admin → dashboard completo, staff → su vista personalizada

### Dashboard (admin)
- Resumen de la comisión activa: alumnos, % asistencia, estado de guías, alertas de cobranza
- Accesos rápidos a cada módulo

### Dashboard (staff)
- Lista de sus tutelados con semáforo de estado (asistencia, guías, coaching observado)
- Botón rápido para cargar asistencia de la clase del día

### Alumnos
- Tabla con búsqueda y filtros
- Ficha por alumno: todos sus datos, historial de asistencia, guías, mediciones, coaching observado
- Vista rápida de tutelados propios (destacada para staff)

### Cobranza (admin only — no aparece en el menú del staff)
- Panel de alertas activas (alumnos en mora con días de atraso y nivel)
- Tabla mensual: todos los alumnos con estado pagó/pendiente/condición especial
- Botón "Cargar comprobante" → flujo IA
- Historial de recordatorios enviados

### Módulo Guías
- Selector de mes + año
- Grid: alumnos × guías del mes
- Checkbox entregó / no entregó
- Admin puede crear/editar las guías del mes

### Módulo Audiencias
- Selector de equipo y fecha
- Dropdown con escala Multiplico/Sumo/Igualo/Divido/Resto
- Historial por equipo

### Módulo Mediciones
- Admin crea la medición (fecha, nombre)
- Grilla de carga de notas por alumno (0 a 10)
- Promedio automático no se calcula con audiencias

### Coaching Observado
- Tabs: Fase 1 / Fase 2 / Fase 3
- Fase 1 y 2: tabla de sesiones + semáforo de mínimos por alumno
- Fase 3: por alumno, progreso 0/24 sesiones + tabla de domingos con estado de entregas y evaluación del tutor

---

## Configuración inicial (seed)

Al iniciar por primera vez, el sistema debe crear:
- Usuario admin: `admin@ecoa.com` / contraseña: `ecoa2026` (forzar cambio en primer login)
- Una comisión activa de ejemplo: "Comisión 2026"

---

## Deploy gratuito: Render + Supabase

### Base de datos: Supabase (gratuito, sin vencimiento)
1. Crear cuenta en supabase.com
2. Crear nuevo proyecto
3. Copiar la `DATABASE_URL` (connection string) desde Settings → Database
4. Usar driver `pg` (node-postgres) en lugar de better-sqlite3
5. El SQL del schema es compatible, solo ajustar tipos: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`

### Servidor: Render.com (gratuito)
1. Crear cuenta en render.com
2. Nuevo "Web Service" → conectar repositorio de GitHub
3. Build command: `npm install && npm run build`
4. Start command: `node server/index.js`
5. Variables de entorno:
   - `DATABASE_URL` (connection string de Supabase)
   - `JWT_SECRET` (string aleatorio largo)
   - `ANTHROPIC_API_KEY` (para lectura de comprobantes)
   - `NODE_ENV=production`

> **Nota importante**: El plan gratuito de Render "duerme" el servidor tras 15 minutos sin uso y tarda ~30 segundos en volver a responder. Para el uso interno de la app (staff accediendo regularmente) esto no representa un problema en la práctica.

**render.yaml:**
```yaml
services:
  - type: web
    name: ecoa-gestion
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: node server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
```

---

## Instrucción para Claude Code

> Construí este sistema completo según el brief. Empezá por:
> 1. Estructura de carpetas y configuración del proyecto (package.json, vite.config, tailwind)
> 2. Base de datos: db.js con todas las tablas y seed inicial
> 3. Autenticación: registro, login, middleware de roles
> 4. Módulo Alumnos completo (CRUD)
> 5. Módulo Cobranza completo (admin only)
> 6. Resto de módulos académicos
> 7. Build y configuración de deploy en Railway
>
> Usá español en toda la interfaz. El diseño debe ser limpio, funcional y mobile-friendly (muchos usuarios acceden desde celular).

