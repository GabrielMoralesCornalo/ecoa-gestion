const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// GET /api/users  (admin: todos; staff: solo su perfil)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const { rows } = await pool.query(
        'SELECT id, name, email, role, active, created_at FROM users ORDER BY name'
      )
      return res.json(rows)
    }
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/users/staff  — lista de staff para selectores
router.get('/staff', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role FROM users WHERE active = true ORDER BY name"
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/users  (solo admin)
router.post('/', auth, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Todos los campos son obligatorios' })
  if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'Rol inválido' })

  try {
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES ($1,$2,$3,$4,true) RETURNING id, name, email, role',
      [name, email.toLowerCase(), hash, role]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' })
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/users/:id  (admin: cualquiera; staff: solo el suyo)
router.put('/:id', auth, async (req, res) => {
  const targetId = parseInt(req.params.id)
  if (req.user.role !== 'admin' && req.user.id !== targetId)
    return res.status(403).json({ error: 'Sin permiso' })

  const { name, email, role, active } = req.body
  try {
    const fields = []
    const values = []
    let idx = 1
    if (name)   { fields.push(`name = $${idx++}`);   values.push(name) }
    if (email)  { fields.push(`email = $${idx++}`);  values.push(email.toLowerCase()) }
    if (req.user.role === 'admin') {
      if (role !== undefined)   { fields.push(`role = $${idx++}`);   values.push(role) }
      if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active) }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })
    values.push(targetId)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values)
    res.json({ message: 'Usuario actualizado' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/users/:id  (solo admin, desactiva)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE users SET active = false WHERE id = $1', [req.params.id])
    res.json({ message: 'Usuario desactivado' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
