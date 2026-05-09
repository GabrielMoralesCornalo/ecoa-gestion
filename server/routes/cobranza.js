const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Anthropic = require('@anthropic-ai/sdk')
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')

// Todas las rutas de cobranza requieren ser admin
router.use(auth, adminOnly)

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `comprobante_${Date.now()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// GET /api/cobranza/fees?cohort_id=&month=
router.get('/fees', async (req, res) => {
  try {
    const { cohort_id, month } = req.query
    let q = `SELECT f.*, s.name AS student_name FROM fees f JOIN students s ON f.student_id=s.id WHERE 1=1`
    const p = []; let i = 1
    if (cohort_id) { q += ` AND s.cohort_id=$${i++}`; p.push(cohort_id) }
    if (month)     { q += ` AND f.month=$${i++}`;     p.push(month) }
    q += ' ORDER BY s.name'
    const { rows } = await pool.query(q, p)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/cobranza/fees  — crear/actualizar cuota de un alumno
router.post('/fees', async (req, res) => {
  const { student_id, month, amount, condition, condition_notes } = req.body
  if (!student_id || !month || !amount) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO fees (student_id, month, amount, condition, condition_notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id, month)
       DO UPDATE SET amount=$3, condition=$4, condition_notes=$5
       RETURNING *`,
      [student_id, month, amount, condition || 'normal', condition_notes || null]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/cobranza/payments?cohort_id=&month=
router.get('/payments', async (req, res) => {
  try {
    const { cohort_id, month } = req.query
    let q = `SELECT p.*, s.name AS student_name, u.name AS registered_by_name
             FROM payments p
             JOIN students s ON p.student_id=s.id
             LEFT JOIN users u ON p.registered_by=u.id
             WHERE 1=1`
    const p = []; let i = 1
    if (cohort_id) { q += ` AND s.cohort_id=$${i++}`; p.push(cohort_id) }
    if (month)     { q += ` AND p.month=$${i++}`;     p.push(month) }
    q += ' ORDER BY p.created_at DESC'
    const { rows } = await pool.query(q, p)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// GET /api/cobranza/panel?cohort_id=&month=  — panel estado mensual
router.get('/panel', async (req, res) => {
  try {
    const { cohort_id, month } = req.query
    if (!cohort_id || !month) return res.status(400).json({ error: 'cohort_id y month requeridos' })

    const today = new Date()
    const dayOfMonth = today.getDate()

    const students = await pool.query(
      'SELECT id, name FROM students WHERE cohort_id=$1 AND active=true ORDER BY name',
      [cohort_id]
    )

    const fees = await pool.query('SELECT * FROM fees WHERE month=$1', [month])
    const payments = await pool.query('SELECT * FROM payments WHERE month=$1', [month])
    const reminders = await pool.query('SELECT * FROM payment_reminders WHERE month=$1', [month])

    const feesMap = {}
    fees.rows.forEach(f => { feesMap[f.student_id] = f })
    const paymentsMap = {}
    payments.rows.forEach(p => { paymentsMap[p.student_id] = p })
    const remindersMap = {}
    reminders.rows.forEach(r => {
      if (!remindersMap[r.student_id]) remindersMap[r.student_id] = []
      remindersMap[r.student_id].push(r)
    })

    const result = students.rows.map(s => {
      const fee = feesMap[s.id] || null
      const payment = paymentsMap[s.id] || null
      const paid = !!payment
      let alertLevel = null
      let daysLate = 0

      if (!paid && dayOfMonth > 10) {
        daysLate = dayOfMonth - 10
        if (daysLate >= 1 && daysLate <= 5)   alertLevel = '1er_aviso'
        else if (daysLate <= 10)               alertLevel = '2do_aviso'
        else if (daysLate <= 15)               alertLevel = 'formal'
        else                                   alertLevel = 'critico'
      }

      return {
        student_id: s.id,
        student_name: s.name,
        fee,
        payment,
        paid,
        days_late: daysLate,
        alert_level: alertLevel,
        reminders: remindersMap[s.id] || [],
      }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/cobranza/payments  — registrar pago manual
router.post('/payments', async (req, res) => {
  const { student_id, month, paid_date, amount_paid, method, notes } = req.body
  if (!student_id || !month) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (student_id, month, paid_date, amount_paid, method, registered_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [student_id, month, paid_date || null, amount_paid || null, method || null, req.user.id, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// DELETE /api/cobranza/payments/:id
router.delete('/payments/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT receipt_image_path FROM payments WHERE id=$1', [req.params.id])
    if (rows[0]?.receipt_image_path) {
      const filePath = path.join(__dirname, '../../', rows[0].receipt_image_path)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    await pool.query('DELETE FROM payments WHERE id=$1', [req.params.id])
    res.json({ message: 'Pago eliminado' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/cobranza/scan-receipt  — leer comprobante con IA
router.post('/scan-receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

  try {
    const imageData = fs.readFileSync(req.file.path)
    const base64 = imageData.toString('base64')
    const mimeType = req.file.mimetype || 'image/jpeg'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: 'Sos un asistente que extrae datos de comprobantes de pago argentinos. Analizá la imagen y devolvé SOLO un JSON con este formato exacto, sin texto adicional: {"payer_name": "...", "amount": 0000, "date": "YYYY-MM-DD", "source": "..."} Si no podés determinar algún campo, usá null.',
          },
        ],
      }],
    })

    let extracted = {}
    try {
      extracted = JSON.parse(message.content[0].text.trim())
    } catch {
      return res.status(422).json({ error: 'No se pudo interpretar el comprobante', raw: message.content[0].text })
    }

    // Fuzzy matching contra alumnos
    const { rows: students } = await pool.query(
      'SELECT id, name FROM students WHERE active=true ORDER BY name'
    )

    function normalize(str) {
      return (str || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').trim()
    }

    const payerNorm = normalize(extracted.payer_name)

    const scored = students.map(s => {
      const nameNorm = normalize(s.name)
      let score = 0
      if (payerNorm && nameNorm) {
        if (nameNorm.includes(payerNorm) || payerNorm.includes(nameNorm)) score = 100
        else {
          const payerWords = payerNorm.split(' ').filter(w => w.length > 3)
          const nameWords  = nameNorm.split(' ').filter(w => w.length > 3)
          const common = payerWords.filter(w => nameWords.includes(w))
          score = common.length >= 2 ? 80 : common.length === 1 ? 40 : 0
        }
      }
      return { ...s, score }
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)

    res.json({
      extracted,
      matches: scored,
      receipt_path: `uploads/${req.file.filename}`,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al procesar el comprobante' })
  }
})

// POST /api/cobranza/payments/from-receipt  — confirmar y registrar pago desde comprobante
router.post('/payments/from-receipt', async (req, res) => {
  const { student_id, month, paid_date, amount_paid, method, receipt_path, notes } = req.body
  if (!student_id || !month) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (student_id, month, paid_date, amount_paid, method, receipt_image_path, registered_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [student_id, month, paid_date || null, amount_paid || null, method || 'transferencia', receipt_path || null, req.user.id, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// POST /api/cobranza/reminders
router.post('/reminders', async (req, res) => {
  const { student_id, month, alert_level, notes } = req.body
  if (!student_id || !month) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO payment_reminders (student_id, month, alert_level, sent_by, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, month, alert_level || null, req.user.id, notes || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

module.exports = router
