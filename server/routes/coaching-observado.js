const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// ─── FASE 1 ────────────────────────────────────────────────────────────────

// GET /api/coaching-observado/fase1?cohort_id=
router.get('/fase1', auth, async (req, res) => {
  try {
    const { cohort_id } = req.query
    const { rows } = await pool.query(`
      SELECT cf1.*, s.name AS student_name, u.name AS coach_name
      FROM co_fase1 cf1
      JOIN students s ON cf1.student_id=s.id
      LEFT JOIN users u ON cf1.coach_id=u.id
      WHERE cf1.cohort_id=$1
      ORDER BY cf1.date DESC
    `, [cohort_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/fase1', auth, async (req, res) => {
  const { cohort_id, date, coach_id, student_id, notes } = req.body
  if (!cohort_id || !date || !student_id) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO co_fase1 (cohort_id, date, coach_id, student_id, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cohort_id, date, coach_id || req.user.id, student_id, notes || null, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.delete('/fase1/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM co_fase1 WHERE id=$1', [req.params.id])
    res.json({ message: 'Sesión eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/coaching-observado/fase1/summary/:cohort_id  — semáforo mínimos
router.get('/fase1/summary/:cohort_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name,
        COUNT(cf1.id) AS sesiones_como_coachee
      FROM students s
      LEFT JOIN co_fase1 cf1 ON cf1.student_id=s.id AND cf1.cohort_id=$1
      WHERE s.cohort_id=$1 AND s.active=true
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [req.params.cohort_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// ─── FASE 2 ────────────────────────────────────────────────────────────────

router.get('/fase2', auth, async (req, res) => {
  try {
    const { cohort_id } = req.query
    const { rows } = await pool.query(`
      SELECT cf2.*,
        sc.name AS coach_name,
        se.name AS coachee_name
      FROM co_fase2 cf2
      JOIN students sc ON cf2.student_coach_id=sc.id
      JOIN students se ON cf2.student_coachee_id=se.id
      WHERE cf2.cohort_id=$1
      ORDER BY cf2.date DESC
    `, [cohort_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/fase2', auth, async (req, res) => {
  const { cohort_id, date, student_coach_id, student_coachee_id, notes } = req.body
  if (!cohort_id || !date || !student_coach_id || !student_coachee_id)
    return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO co_fase2 (cohort_id, date, student_coach_id, student_coachee_id, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cohort_id, date, student_coach_id, student_coachee_id, notes || null, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.delete('/fase2/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM co_fase2 WHERE id=$1', [req.params.id])
    res.json({ message: 'Sesión eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.get('/fase2/summary/:cohort_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name,
        COUNT(cf2.id) FILTER (WHERE cf2.student_coach_id=s.id)   AS sesiones_como_coach,
        COUNT(cf2.id) FILTER (WHERE cf2.student_coachee_id=s.id) AS sesiones_como_coachee
      FROM students s
      LEFT JOIN co_fase2 cf2 ON (cf2.student_coach_id=s.id OR cf2.student_coachee_id=s.id) AND cf2.cohort_id=$1
      WHERE s.cohort_id=$1 AND s.active=true
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [req.params.cohort_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// ─── FASE 3 ────────────────────────────────────────────────────────────────

// Sesiones externas
router.get('/fase3/sessions', auth, async (req, res) => {
  try {
    const { student_id } = req.query
    const { rows } = await pool.query(
      'SELECT * FROM co_fase3_sessions WHERE student_id=$1 ORDER BY session_number',
      [student_id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/fase3/sessions', auth, async (req, res) => {
  const { student_id, session_number, date, coachee_name, notes } = req.body
  if (!student_id) return res.status(400).json({ error: 'student_id requerido' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO co_fase3_sessions (student_id, session_number, date, coachee_name, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, session_number || null, date || null, coachee_name || null, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.delete('/fase3/sessions/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM co_fase3_sessions WHERE id=$1', [req.params.id])
    res.json({ message: 'Sesión eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// Entregas de domingos
router.get('/fase3/submissions', auth, async (req, res) => {
  try {
    const { student_id } = req.query
    const { rows } = await pool.query(`
      SELECT cf3s.*, u.name AS tutor_name
      FROM co_fase3_submissions cf3s
      LEFT JOIN users u ON cf3s.tutor_id=u.id
      WHERE cf3s.student_id=$1
      ORDER BY cf3s.sunday_date DESC
    `, [student_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/fase3/submissions', auth, async (req, res) => {
  const { student_id, sunday_date, auto_obs_1, auto_obs_2, video_submitted, tutor_eval, tutor_id, eval_date, notes } = req.body
  if (!student_id || !sunday_date) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO co_fase3_submissions (student_id, sunday_date, auto_obs_1, auto_obs_2, video_submitted, tutor_eval, tutor_id, eval_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (student_id, sunday_date)
       DO UPDATE SET auto_obs_1=$3, auto_obs_2=$4, video_submitted=$5, tutor_eval=$6, tutor_id=$7, eval_date=$8, notes=$9
       RETURNING *`,
      [student_id, sunday_date, auto_obs_1 ?? false, auto_obs_2 ?? false, video_submitted ?? false,
       tutor_eval || null, tutor_id || null, eval_date || null, notes || null]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/coaching-observado/fase3/summary/:cohort_id
router.get('/fase3/summary/:cohort_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name,
        COUNT(DISTINCT cf3s.id) AS sesiones_completadas,
        COUNT(DISTINCT cf3sub.sunday_date) AS domingos_entregados
      FROM students s
      LEFT JOIN co_fase3_sessions cf3s ON cf3s.student_id=s.id
      LEFT JOIN co_fase3_submissions cf3sub ON cf3sub.student_id=s.id
      WHERE s.cohort_id=$1 AND s.active=true
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [req.params.cohort_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
