const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cohorts ORDER BY year_started DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.get('/active', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cohorts WHERE active = true ORDER BY year_started DESC LIMIT 1')
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/', auth, adminOnly, async (req, res) => {
  const { name, year_started } = req.body
  if (!name || !year_started) return res.status(400).json({ error: 'Nombre y año requeridos' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO cohorts (name, year_started) VALUES ($1,$2) RETURNING *',
      [name, year_started]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, year_started, active } = req.body
  try {
    await pool.query(
      'UPDATE cohorts SET name=$1, year_started=$2, active=$3 WHERE id=$4',
      [name, year_started, active, req.params.id]
    )
    res.json({ message: 'Comisión actualizada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
