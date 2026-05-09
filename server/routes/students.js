const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/students?cohort_id=&career_year=&active=
router.get('/', auth, async (req, res) => {
  try {
    const { cohort_id, career_year, active } = req.query
    let query = `
      SELECT s.*,
        u1.name AS tutor_y1_name,
        u2.name AS tutor_y2_name,
        c.name AS cohort_name
      FROM students s
      LEFT JOIN users u1 ON s.tutor_y1_id = u1.id
      LEFT JOIN users u2 ON s.tutor_y2_id = u2.id
      LEFT JOIN cohorts c ON s.cohort_id = c.id
      WHERE 1=1
    `
    const params = []
    let idx = 1

    if (cohort_id) { query += ` AND s.cohort_id = $${idx++}`; params.push(cohort_id) }
    if (career_year) { query += ` AND s.career_year = $${idx++}`; params.push(career_year) }
    if (active !== undefined) { query += ` AND s.active = $${idx++}`; params.push(active !== 'false') }

    // Staff solo ve sus tutelados destacados, pero puede ver todos en modo lectura
    query += ' ORDER BY s.name'
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/students/my-tutored  — tutelados del staff logueado
router.get('/my-tutored', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, c.name AS cohort_name
      FROM students s
      LEFT JOIN cohorts c ON s.cohort_id = c.id
      WHERE (s.tutor_y1_id = $1 OR s.tutor_y2_id = $1) AND s.active = true
      ORDER BY s.name
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/students/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        u1.name AS tutor_y1_name,
        u2.name AS tutor_y2_name,
        c.name AS cohort_name
      FROM students s
      LEFT JOIN users u1 ON s.tutor_y1_id = u1.id
      LEFT JOIN users u2 ON s.tutor_y2_id = u2.id
      LEFT JOIN cohorts c ON s.cohort_id = c.id
      WHERE s.id = $1
    `, [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Alumno no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/students  (solo admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { cohort_id, name, phone, email, career_year, tutor_y1_id, tutor_y2_id } = req.body
  if (!cohort_id || !name) return res.status(400).json({ error: 'Comisión y nombre son requeridos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO students (cohort_id, name, phone, email, career_year, tutor_y1_id, tutor_y2_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cohort_id, name, phone || null, email || null, career_year || 1, tutor_y1_id || null, tutor_y2_id || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/students/:id  (solo admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, phone, email, career_year, tutor_y1_id, tutor_y2_id, active, cohort_id } = req.body
  try {
    await pool.query(
      `UPDATE students SET name=$1, phone=$2, email=$3, career_year=$4,
       tutor_y1_id=$5, tutor_y2_id=$6, active=$7, cohort_id=$8
       WHERE id=$9`,
      [name, phone || null, email || null, career_year, tutor_y1_id || null, tutor_y2_id || null, active, cohort_id, req.params.id]
    )
    res.json({ message: 'Alumno actualizado' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/students/:id  (solo admin, desactiva)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE students SET active = false WHERE id = $1', [req.params.id])
    res.json({ message: 'Alumno desactivado' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/students/:id/ficha  — datos completos del alumno
router.get('/:id/ficha', auth, async (req, res) => {
  try {
    const sid = req.params.id
    const [student, attendance, guides, mediciones, co1, co2, co3s, co3sub, payments] = await Promise.all([
      pool.query(`SELECT s.*, u1.name AS tutor_y1_name, u2.name AS tutor_y2_name, c.name AS cohort_name
        FROM students s LEFT JOIN users u1 ON s.tutor_y1_id=u1.id LEFT JOIN users u2 ON s.tutor_y2_id=u2.id
        LEFT JOIN cohorts c ON s.cohort_id=c.id WHERE s.id=$1`, [sid]),
      pool.query(`SELECT a.*, cl.date, cl.topic, cl.month_number FROM attendance a
        JOIN classes cl ON a.class_id=cl.id WHERE a.student_id=$1 ORDER BY cl.date DESC`, [sid]),
      pool.query(`SELECT gd.*, g.title, g.month_number, g.guide_number, g.career_year FROM guide_deliveries gd
        JOIN guides g ON gd.guide_id=g.id WHERE gd.student_id=$1 ORDER BY g.month_number, g.guide_number`, [sid]),
      pool.query(`SELECT mr.*, m.title, m.date, m.career_year, m.number FROM medicion_results mr
        JOIN mediciones m ON mr.medicion_id=m.id WHERE mr.student_id=$1 ORDER BY m.date`, [sid]),
      pool.query(`SELECT cf1.*, u.name AS coach_name FROM co_fase1 cf1 LEFT JOIN users u ON cf1.coach_id=u.id
        WHERE cf1.student_id=$1 ORDER BY cf1.date DESC`, [sid]),
      pool.query(`SELECT cf2.*, s.name AS coach_name FROM co_fase2 cf2 LEFT JOIN students s ON cf2.student_coach_id=s.id
        WHERE cf2.student_coachee_id=$1 OR cf2.student_coach_id=$1 ORDER BY cf2.date DESC`, [sid]),
      pool.query(`SELECT * FROM co_fase3_sessions WHERE student_id=$1 ORDER BY session_number`, [sid]),
      pool.query(`SELECT cf3s.*, u.name AS tutor_name FROM co_fase3_submissions cf3s
        LEFT JOIN users u ON cf3s.tutor_id=u.id WHERE cf3s.student_id=$1 ORDER BY cf3s.sunday_date DESC`, [sid]),
      pool.query(`SELECT p.*, f.amount AS fee_amount, f.condition FROM payments p
        LEFT JOIN fees f ON f.student_id=p.student_id AND f.month=p.month
        WHERE p.student_id=$1 ORDER BY p.month DESC`, [sid]),
    ])

    if (!student.rows[0]) return res.status(404).json({ error: 'Alumno no encontrado' })

    res.json({
      student: student.rows[0],
      attendance: attendance.rows,
      guides: guides.rows,
      mediciones: mediciones.rows,
      co_fase1: co1.rows,
      co_fase2: co2.rows,
      co_fase3_sessions: co3s.rows,
      co_fase3_submissions: co3sub.rows,
      payments: payments.rows,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
