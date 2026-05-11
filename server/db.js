const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function initDB() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','staff')),
        active BOOLEAN DEFAULT TRUE,
        must_change_password BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS cohorts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        year_started INTEGER NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        career_year INTEGER DEFAULT 1 CHECK(career_year IN (1,2)),
        tutor_y1_id INTEGER REFERENCES users(id),
        tutor_y2_id INTEGER REFERENCES users(id),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        name TEXT NOT NULL,
        career_year INTEGER CHECK(career_year IN (1,2)),
        from_month INTEGER,
        to_month INTEGER,
        active BOOLEAN DEFAULT TRUE
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        student_id INTEGER REFERENCES students(id),
        UNIQUE(team_id, student_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        career_year INTEGER,
        date DATE NOT NULL,
        month_number INTEGER,
        topic TEXT,
        created_by INTEGER REFERENCES users(id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id),
        student_id INTEGER REFERENCES students(id),
        present BOOLEAN DEFAULT FALSE,
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        recorded_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(class_id, student_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS guides (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        career_year INTEGER,
        month_number INTEGER,
        guide_number INTEGER CHECK(guide_number IN (1,2)),
        title TEXT,
        created_by INTEGER REFERENCES users(id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS guide_deliveries (
        id SERIAL PRIMARY KEY,
        guide_id INTEGER REFERENCES guides(id),
        student_id INTEGER REFERENCES students(id),
        delivered BOOLEAN DEFAULT FALSE,
        delivery_date DATE,
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        UNIQUE(guide_id, student_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS audiencia_evaluations (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        cohort_id INTEGER REFERENCES cohorts(id),
        date DATE NOT NULL,
        career_year INTEGER,
        month_number INTEGER,
        scale_result TEXT CHECK(scale_result IN ('MULTIPLICO','SUMO','IGUALO','DIVIDO','RESTO')),
        evaluator_id INTEGER REFERENCES users(id),
        notes TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS mediciones (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        career_year INTEGER,
        number INTEGER CHECK(number IN (1,2)),
        date DATE,
        title TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS medicion_results (
        id SERIAL PRIMARY KEY,
        medicion_id INTEGER REFERENCES mediciones(id),
        student_id INTEGER REFERENCES students(id),
        grade REAL CHECK(grade >= 0 AND grade <= 10),
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        UNIQUE(medicion_id, student_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS final_oral (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        date DATE
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS final_oral_results (
        id SERIAL PRIMARY KEY,
        final_oral_id INTEGER REFERENCES final_oral(id),
        student_id INTEGER REFERENCES students(id),
        grade REAL CHECK(grade >= 0 AND grade <= 10),
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        UNIQUE(final_oral_id, student_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        month TEXT NOT NULL,
        amount REAL NOT NULL,
        condition TEXT DEFAULT 'normal' CHECK(condition IN ('normal','beca','diferencial','bimestral')),
        condition_notes TEXT,
        UNIQUE(student_id, month)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        month TEXT NOT NULL,
        paid_date DATE,
        amount_paid REAL,
        method TEXT,
        receipt_image_path TEXT,
        registered_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_reminders (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        month TEXT NOT NULL,
        sent_date TIMESTAMP DEFAULT NOW(),
        alert_level TEXT,
        sent_by INTEGER REFERENCES users(id),
        notes TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS co_fase1 (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        date DATE NOT NULL,
        coach_id INTEGER REFERENCES users(id),
        student_id INTEGER REFERENCES students(id),
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS co_fase2 (
        id SERIAL PRIMARY KEY,
        cohort_id INTEGER REFERENCES cohorts(id),
        date DATE NOT NULL,
        student_coach_id INTEGER REFERENCES students(id),
        student_coachee_id INTEGER REFERENCES students(id),
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS co_fase3_sessions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        session_number INTEGER,
        date DATE,
        coachee_name TEXT,
        notes TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS co_fase3_submissions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        sunday_date DATE NOT NULL,
        auto_obs_1 BOOLEAN DEFAULT FALSE,
        auto_obs_2 BOOLEAN DEFAULT FALSE,
        video_submitted BOOLEAN DEFAULT FALSE,
        tutor_eval TEXT CHECK(tutor_eval IN ('NO_ALCANZO','ALCANZO','ALCANZO_SATISFACTORIAMENTE','SUPERO')),
        tutor_id INTEGER REFERENCES users(id),
        eval_date DATE,
        notes TEXT,
        UNIQUE(student_id, sunday_date)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // Seed settings por defecto
    await client.query(`
      INSERT INTO app_settings (key, value) VALUES
        ('due_day', '10'),
        ('alert_interval_days', '5'),
        ('whatsapp_recipients', '[]')
      ON CONFLICT (key) DO NOTHING
    `)

    // Seed: admin por defecto
    const existing = await client.query("SELECT id FROM users WHERE email = 'admin@ecoa.com'")
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('ecoa2026', 10)
      await client.query(
        "INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,$5)",
        ['Administrador ECOA', 'admin@ecoa.com', hash, 'admin', true]
      )
    }

    // Seed: comisión activa de ejemplo
    const existingCohort = await client.query("SELECT id FROM cohorts WHERE name = 'Comisión 2026'")
    if (existingCohort.rows.length === 0) {
      await client.query(
        "INSERT INTO cohorts (name, year_started, active) VALUES ($1,$2,$3)",
        ['Comisión 2026', 2026, true]
      )
    }

    await client.query('COMMIT')
    console.log('✅ Base de datos inicializada correctamente')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error al inicializar la base de datos:', err)
    throw err
  } finally {
    client.release()
  }
}

module.exports = { pool, initDB }
