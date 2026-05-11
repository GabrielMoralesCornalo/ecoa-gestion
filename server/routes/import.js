const router = require('express').Router()
const { pool } = require('../db')
const auth = require('../middleware/auth')
const adminOnly = require('../middleware/adminOnly')
const multer = require('multer')
const XLSX = require('xlsx')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

// POST /api/import/students
router.post('/students', auth, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    const rows = parseSheet(req.file.buffer)
    const results = { ok: 0, errors: [] }
    for (const [i, r] of rows.entries()) {
      const rowNum = i + 2
      const name = String(r['Nombre'] || r['name'] || '').trim()
      const email = String(r['Email'] || r['email'] || '').trim()
      const cohortName = String(r['Comisión'] || r['cohort'] || '').trim()
      const careerYear = parseInt(r['Año'] || r['career_year'] || 1) || 1
      const phone = String(r['Teléfono'] || r['phone'] || '').trim()
      const dni = String(r['DNI'] || r['dni'] || '').trim()

      if (!name) { results.errors.push(`Fila ${rowNum}: falta Nombre`); continue }
      if (!cohortName) { results.errors.push(`Fila ${rowNum}: falta Comisión`); continue }

      const cohortRes = await pool.query('SELECT id FROM cohorts WHERE LOWER(name) = LOWER($1)', [cohortName])
      if (cohortRes.rows.length === 0) {
        results.errors.push(`Fila ${rowNum}: comisión "${cohortName}" no encontrada`)
        continue
      }
      const cohortId = cohortRes.rows[0].id

      try {
        await pool.query(
          `INSERT INTO students (name, email, phone, dni, cohort_id, career_year, active)
           VALUES ($1,$2,$3,$4,$5,$6,true)
           ON CONFLICT (email) DO UPDATE SET name=$1, phone=$3, dni=$4, cohort_id=$5, career_year=$6`,
          [name, email || null, phone || null, dni || null, cohortId, careerYear]
        )
        results.ok++
      } catch (err) {
        results.errors.push(`Fila ${rowNum}: ${err.message}`)
      }
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message })
  }
})

// POST /api/import/classes
router.post('/classes', auth, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    const rows = parseSheet(req.file.buffer)
    const results = { ok: 0, errors: [] }
    for (const [i, r] of rows.entries()) {
      const rowNum = i + 2
      const cohortName = String(r['Comisión'] || r['cohort'] || '').trim()
      const rawDate = r['Fecha'] || r['date'] || ''
      const careerYear = parseInt(r['Año'] || r['career_year'] || 1) || 1
      const monthNumber = parseInt(r['Mes'] || r['month_number'] || '') || null
      const topic = String(r['Tema'] || r['topic'] || '').trim()

      if (!cohortName) { results.errors.push(`Fila ${rowNum}: falta Comisión`); continue }
      if (!rawDate) { results.errors.push(`Fila ${rowNum}: falta Fecha`); continue }

      let date
      if (rawDate instanceof Date) {
        date = rawDate.toISOString().slice(0, 10)
      } else {
        const parsed = new Date(rawDate)
        if (isNaN(parsed)) { results.errors.push(`Fila ${rowNum}: fecha inválida "${rawDate}"`); continue }
        date = parsed.toISOString().slice(0, 10)
      }

      const cohortRes = await pool.query('SELECT id FROM cohorts WHERE LOWER(name) = LOWER($1)', [cohortName])
      if (cohortRes.rows.length === 0) {
        results.errors.push(`Fila ${rowNum}: comisión "${cohortName}" no encontrada`)
        continue
      }
      const cohortId = cohortRes.rows[0].id

      try {
        await pool.query(
          `INSERT INTO classes (cohort_id, career_year, date, month_number, topic, created_by)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [cohortId, careerYear, date, monthNumber, topic || null, req.user.id]
        )
        results.ok++
      } catch (err) {
        results.errors.push(`Fila ${rowNum}: ${err.message}`)
      }
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message })
  }
})

// POST /api/import/guides
router.post('/guides', auth, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    const rows = parseSheet(req.file.buffer)
    const results = { ok: 0, errors: [] }
    for (const [i, r] of rows.entries()) {
      const rowNum = i + 2
      const cohortName = String(r['Comisión'] || r['cohort'] || '').trim()
      const careerYear = parseInt(r['Año'] || r['career_year'] || 1) || 1
      const monthNumber = parseInt(r['Mes'] || r['month_number'] || '') || null
      const guideNumber = parseInt(r['Guía N°'] || r['guide_number'] || '') || null
      const title = String(r['Título'] || r['title'] || '').trim()

      if (!cohortName) { results.errors.push(`Fila ${rowNum}: falta Comisión`); continue }
      if (!monthNumber) { results.errors.push(`Fila ${rowNum}: falta Mes`); continue }
      if (!guideNumber) { results.errors.push(`Fila ${rowNum}: falta Guía N°`); continue }

      const cohortRes = await pool.query('SELECT id FROM cohorts WHERE LOWER(name) = LOWER($1)', [cohortName])
      if (cohortRes.rows.length === 0) {
        results.errors.push(`Fila ${rowNum}: comisión "${cohortName}" no encontrada`)
        continue
      }
      const cohortId = cohortRes.rows[0].id

      try {
        await pool.query(
          `INSERT INTO guides (cohort_id, career_year, month_number, guide_number, title, created_by)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (cohort_id, career_year, month_number, guide_number)
           DO UPDATE SET title=$5`,
          [cohortId, careerYear, monthNumber, guideNumber, title || null, req.user.id]
        )
        results.ok++
      } catch (err) {
        results.errors.push(`Fila ${rowNum}: ${err.message}`)
      }
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message })
  }
})

module.exports = router
