const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../db')
const authMiddleware = require('../middleware/auth')

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase()])
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, must_change_password: user.must_change_password },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
    const user = rows[0]

    // Si es cambio forzado (primer login), no validamos la contraseña actual
    if (!user.must_change_password) {
      if (!current_password) return res.status(400).json({ error: 'Contraseña actual requerida' })
      const valid = await bcrypt.compare(current_password, user.password_hash)
      if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }

    const hash = await bcrypt.hash(new_password, 10)
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [hash, req.user.id]
    )
    res.json({ message: 'Contraseña actualizada' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, must_change_password FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
