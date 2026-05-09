const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/attendance/classes?cohort_id=&career_year=
router.get('/classes', auth, async (req, res) => {
  try {
    const { cohort_id, career_year } = req.query
    let q = `SELECT cl.*, u.name AS created_by_name FROM classes cl
             LEFT JOIN users u ON cl.created_by=u.id WHERE 1=1`
    const p = []
    let i = 1
    if (cohort_id)   { q += ` AND cl.cohort_id=$${i++}`;   p.push(cohort_id) }
    if (career_year) { q += ` AND cl.career_year=$${i++}`; p.push(career_year) }
    q += ' ORDER BY cl.date DESC'
    const { rows } = await pool.query(q, p)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/attendance/classes
router.post('/classes', auth, async (req, res) => {
  const { cohort_id, career_year, date, month_number, topic } = req.body
  if (!cohort_id || !date) return res.status(400).json({ error: 'Comisión y fecha requeridas' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO classes (cohort_id, career_year, date, month_number, topic, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cohort_id, career_year || 1, date, month_number || null, topic || null, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/attendance/classes/:id  (solo admin)
router.delete('/classes/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM attendance WHERE class_id=$1', [req.params.id])
    await pool.query('DELETE FROM classes WHERE id=$1', [req.params.id])
    res.json({ message: 'Clase eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/attendance/:class_id  — asistencia de una clase
router.get('/:class_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, s.name AS student_name
      FROM attendance a
      JOIN students s ON a.student_id=s.id
      WHERE a.class_id=$1
      ORDER BY s.name
    `, [req.params.class_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/attendance/:class_id  — guardar asistencia completa de una clase
router.post('/:class_id', auth, async (req, res) => {
  // body: [{ student_id, present, notes }]
  const records = req.body
  if (!Array.isArray(records)) return res.status(400).json({ error: 'Se esperaba un arreglo' })
  const classId = req.params.class_id

  try {
    for (const r of records) {
      await pool.query(
        `INSERT INTO attendance (class_id, student_id, present, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (class_id, student_id)
         DO UPDATE SET present=$3, notes=$4, recorded_by=$5, recorded_at=NOW()`,
        [classId, r.student_id, r.present ?? false, r.notes || null, req.user.id]
      )
    }
    res.json({ message: 'Asistencia guardada' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/attendance/summary/:cohort_id  — resumen por alumno
router.get('/summary/:cohort_id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.name,
        COUNT(a.id) FILTER (WHERE a.present = true)  AS presentes,
        COUNT(a.id) FILTER (WHERE a.present = false) AS ausentes,
        COUNT(DISTINCT cl.id) AS total_clases
      FROM students s
      JOIN classes cl ON cl.cohort_id=$1
      LEFT JOIN attendance a ON a.student_id=s.id AND a.class_id=cl.id
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
