const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/mediciones?cohort_id=
router.get('/', auth, async (req, res) => {
  try {
    const { cohort_id } = req.query
    const { rows } = await pool.query(
      'SELECT * FROM mediciones WHERE cohort_id=$1 ORDER BY career_year, number',
      [cohort_id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/mediciones  (solo admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { cohort_id, career_year, number, date, title } = req.body
  if (!cohort_id || !number) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO mediciones (cohort_id, career_year, number, date, title) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [cohort_id, career_year || 1, number, date || null, title || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/mediciones/:id/results
router.get('/:id/results', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT mr.*, s.name AS student_name
      FROM medicion_results mr
      JOIN students s ON mr.student_id=s.id
      WHERE mr.medicion_id=$1
      ORDER BY s.name
    `, [req.params.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/mediciones/:id/results  (solo admin, bulk)
router.post('/:id/results', auth, adminOnly, async (req, res) => {
  const records = req.body
  if (!Array.isArray(records)) return res.status(400).json({ error: 'Se esperaba un arreglo' })
  try {
    for (const r of records) {
      await pool.query(
        `INSERT INTO medicion_results (medicion_id, student_id, grade, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (medicion_id, student_id)
         DO UPDATE SET grade=$3, notes=$4, recorded_by=$5`,
        [req.params.id, r.student_id, r.grade, r.notes || null, req.user.id]
      )
    }
    res.json({ message: 'Resultados guardados' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/mediciones/:id  (solo admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { title, date, career_year, number } = req.body
  try {
    await pool.query('UPDATE mediciones SET title=$1, date=$2, career_year=$3, number=$4 WHERE id=$5',
      [title, date, career_year, number, req.params.id])
    res.json({ message: 'Medición actualizada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/mediciones/:id  (solo admin)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM medicion_results WHERE medicion_id=$1', [req.params.id])
    await pool.query('DELETE FROM mediciones WHERE id=$1', [req.params.id])
    res.json({ message: 'Medición eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
