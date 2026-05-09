const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/guides?cohort_id=&career_year=&month_number=
router.get('/', auth, async (req, res) => {
  try {
    const { cohort_id, career_year, month_number } = req.query
    let q = 'SELECT g.*, u.name AS created_by_name FROM guides g LEFT JOIN users u ON g.created_by=u.id WHERE 1=1'
    const p = []; let i = 1
    if (cohort_id)    { q += ` AND g.cohort_id=$${i++}`;    p.push(cohort_id) }
    if (career_year)  { q += ` AND g.career_year=$${i++}`;  p.push(career_year) }
    if (month_number) { q += ` AND g.month_number=$${i++}`; p.push(month_number) }
    q += ' ORDER BY g.month_number, g.guide_number'
    const { rows } = await pool.query(q, p)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/guides  (solo admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { cohort_id, career_year, month_number, guide_number, title } = req.body
  if (!cohort_id || !month_number || !guide_number) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO guides (cohort_id, career_year, month_number, guide_number, title, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cohort_id, career_year || 1, month_number, guide_number, title || null, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/guides/:id  (solo admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { title, month_number, guide_number } = req.body
  try {
    await pool.query('UPDATE guides SET title=$1, month_number=$2, guide_number=$3 WHERE id=$4',
      [title, month_number, guide_number, req.params.id])
    res.json({ message: 'Guía actualizada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/guides/:id  (solo admin)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM guide_deliveries WHERE guide_id=$1', [req.params.id])
    await pool.query('DELETE FROM guides WHERE id=$1', [req.params.id])
    res.json({ message: 'Guía eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/guides/:guide_id/deliveries  — entregas de esa guía
router.get('/:guide_id/deliveries', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT gd.*, s.name AS student_name
      FROM guide_deliveries gd
      JOIN students s ON gd.student_id=s.id
      WHERE gd.guide_id=$1
      ORDER BY s.name
    `, [req.params.guide_id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/guides/:guide_id/deliveries  — guardar entregas bulk
router.post('/:guide_id/deliveries', auth, async (req, res) => {
  const records = req.body
  if (!Array.isArray(records)) return res.status(400).json({ error: 'Se esperaba un arreglo' })
  try {
    for (const r of records) {
      await pool.query(
        `INSERT INTO guide_deliveries (guide_id, student_id, delivered, delivery_date, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (guide_id, student_id)
         DO UPDATE SET delivered=$3, delivery_date=$4, notes=$5, recorded_by=$6`,
        [req.params.guide_id, r.student_id, r.delivered ?? false, r.delivery_date || null, r.notes || null, req.user.id]
      )
    }
    res.json({ message: 'Entregas guardadas' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/guides/grid/:cohort_id  — vista grilla mes x guía x alumno
router.get('/grid/:cohort_id', auth, async (req, res) => {
  try {
    const { month_number, career_year } = req.query
    const guides = await pool.query(
      'SELECT * FROM guides WHERE cohort_id=$1 AND month_number=$2 AND career_year=$3 ORDER BY guide_number',
      [req.params.cohort_id, month_number || 1, career_year || 1]
    )
    const students = await pool.query(
      'SELECT id, name FROM students WHERE cohort_id=$1 AND active=true ORDER BY name',
      [req.params.cohort_id]
    )
    const deliveries = guides.rows.length > 0
      ? await pool.query(
          `SELECT * FROM guide_deliveries WHERE guide_id = ANY($1)`,
          [guides.rows.map(g => g.id)]
        )
      : { rows: [] }

    res.json({
      guides: guides.rows,
      students: students.rows,
      deliveries: deliveries.rows,
    })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
