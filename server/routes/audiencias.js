const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/audiencias/teams?cohort_id=
router.get('/teams', auth, async (req, res) => {
  try {
    const { cohort_id } = req.query
    const { rows } = await pool.query(
      'SELECT t.*, array_agg(s.name ORDER BY s.name) AS members FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id LEFT JOIN students s ON tm.student_id=s.id WHERE t.cohort_id=$1 AND t.active=true GROUP BY t.id ORDER BY t.name',
      [cohort_id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/audiencias/teams  (solo admin)
router.post('/teams', auth, adminOnly, async (req, res) => {
  const { cohort_id, name, career_year, from_month, to_month } = req.body
  if (!cohort_id || !name) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO teams (cohort_id, name, career_year, from_month, to_month) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [cohort_id, name, career_year || 1, from_month || null, to_month || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/audiencias/teams/:id/members  (solo admin)
router.post('/teams/:id/members', auth, adminOnly, async (req, res) => {
  const { student_ids } = req.body
  if (!Array.isArray(student_ids)) return res.status(400).json({ error: 'student_ids debe ser un arreglo' })
  try {
    await pool.query('DELETE FROM team_members WHERE team_id=$1', [req.params.id])
    for (const sid of student_ids) {
      await pool.query('INSERT INTO team_members (team_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, sid])
    }
    res.json({ message: 'Miembros actualizados' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/audiencias?cohort_id=&team_id=
router.get('/', auth, async (req, res) => {
  try {
    const { cohort_id, team_id } = req.query
    let q = `SELECT ae.*, t.name AS team_name, u.name AS evaluator_name
             FROM audiencia_evaluations ae
             LEFT JOIN teams t ON ae.team_id=t.id
             LEFT JOIN users u ON ae.evaluator_id=u.id
             WHERE 1=1`
    const p = []; let i = 1
    if (cohort_id) { q += ` AND ae.cohort_id=$${i++}`; p.push(cohort_id) }
    if (team_id)   { q += ` AND ae.team_id=$${i++}`;   p.push(team_id) }
    q += ' ORDER BY ae.date DESC'
    const { rows } = await pool.query(q, p)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/audiencias
router.post('/', auth, async (req, res) => {
  const { team_id, cohort_id, date, career_year, month_number, scale_result, notes } = req.body
  if (!team_id || !date || !scale_result) return res.status(400).json({ error: 'Faltan datos obligatorios' })
  const VALID = ['MULTIPLICO','SUMO','IGUALO','DIVIDO','RESTO']
  if (!VALID.includes(scale_result)) return res.status(400).json({ error: 'Escala inválida' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO audiencia_evaluations (team_id, cohort_id, date, career_year, month_number, scale_result, evaluator_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [team_id, cohort_id, date, career_year || 1, month_number || null, scale_result, req.user.id, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/audiencias/:id  (solo admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { date, scale_result, notes, month_number } = req.body
  try {
    await pool.query(
      'UPDATE audiencia_evaluations SET date=$1, scale_result=$2, notes=$3, month_number=$4 WHERE id=$5',
      [date, scale_result, notes, month_number, req.params.id]
    )
    res.json({ message: 'Evaluación actualizada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/audiencias/:id  (solo admin)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM audiencia_evaluations WHERE id=$1', [req.params.id])
    res.json({ message: 'Evaluación eliminada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
