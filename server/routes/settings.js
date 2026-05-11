const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')
const https = require('https')

// GET /api/settings
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings')
    const s = {}
    for (const r of rows) s[r.key] = r.value
    res.json({
      due_day: parseInt(s.due_day || '10'),
      alert_interval_days: parseInt(s.alert_interval_days || '5'),
      whatsapp_recipients: JSON.parse(s.whatsapp_recipients || '[]'),
    })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

// PUT /api/settings
router.put('/', auth, adminOnly, async (req, res) => {
  const { due_day, alert_interval_days, whatsapp_recipients } = req.body
  try {
    await pool.query(`INSERT INTO app_settings (key,value) VALUES ('due_day',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [String(due_day)])
    await pool.query(`INSERT INTO app_settings (key,value) VALUES ('alert_interval_days',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [String(alert_interval_days)])
    await pool.query(`INSERT INTO app_settings (key,value) VALUES ('whatsapp_recipients',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(whatsapp_recipients)])
    res.json({ message: 'Configuración guardada' })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

function sendWhatsApp(phone, apikey, text) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text)
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`
    https.get(url, (r) => { resolve(r.statusCode) }).on('error', () => resolve(0))
  })
}

// POST /api/settings/test-whatsapp  — enviar mensaje de prueba
router.post('/test-whatsapp', auth, adminOnly, async (req, res) => {
  const { phone, apikey } = req.body
  if (!phone || !apikey) return res.status(400).json({ error: 'Falta teléfono o apikey' })
  const status = await sendWhatsApp(phone, apikey, '✅ ECOA Gestión — conexión de WhatsApp verificada correctamente.')
  res.json({ status })
})

// POST /api/settings/send-alerts  — llamado por cron externo (cron-job.org)
router.post('/send-alerts', async (req, res) => {
  // Verificar secret token para que no cualquiera dispare esto
  const secret = req.headers['x-cron-secret']
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  try {
    const { rows: cfg } = await pool.query('SELECT key, value FROM app_settings')
    const s = {}
    for (const r of cfg) s[r.key] = r.value
    const dueDay = parseInt(s.due_day || '10')
    const intervalDays = parseInt(s.alert_interval_days || '5')
    const recipients = JSON.parse(s.whatsapp_recipients || '[]')

    if (recipients.length === 0) return res.json({ message: 'Sin destinatarios configurados' })

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const monthStr = `${year}-${month}`
    const dueDate = new Date(year, now.getMonth(), dueDay)
    const daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))

    // Solo enviar en días que correspondan al intervalo
    if (daysLate <= 0 || daysLate % intervalDays !== 0) {
      return res.json({ message: `Hoy no corresponde enviar alerta (${daysLate} días desde vencimiento)` })
    }

    // Obtener alumnos que no pagaron este mes
    const { rows: unpaid } = await pool.query(`
      SELECT s.name, s.phone, c.name AS cohort_name
      FROM students s
      JOIN cohorts c ON s.cohort_id = c.id
      WHERE s.active = true
        AND NOT EXISTS (
          SELECT 1 FROM payments p WHERE p.student_id = s.id AND p.month = $1
        )
      ORDER BY c.name, s.name
    `, [monthStr])

    if (unpaid.length === 0) {
      return res.json({ message: 'Todos los alumnos pagaron' })
    }

    // Armar mensaje
    const lines = unpaid.map(u => `• ${u.name} (${u.cohort_name})`).join('\n')
    const text = `⚠️ ECOA Gestión — Alerta de cobranza\n📅 Mes: ${monthStr} | Vencimiento: día ${dueDay} | Atraso: ${daysLate} días\n\n🔴 Sin pagar (${unpaid.length}):\n${lines}`

    // Enviar a todos los destinatarios
    const results = []
    for (const r of recipients) {
      const status = await sendWhatsApp(r.phone, r.apikey, text)
      results.push({ name: r.name, status })
    }

    res.json({ sent: true, recipients: results.length, unpaid: unpaid.length, results })
  } catch (err) {
    console.error('Error en send-alerts:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = { router, sendWhatsApp }
