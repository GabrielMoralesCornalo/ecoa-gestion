require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { initDB } = require('./db')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Rutas API
app.use('/api/auth',              require('./routes/auth'))
app.use('/api/users',             require('./routes/users'))
app.use('/api/cohorts',           require('./routes/cohorts'))
app.use('/api/students',          require('./routes/students'))
app.use('/api/attendance',        require('./routes/attendance'))
app.use('/api/guides',            require('./routes/guides'))
app.use('/api/audiencias',        require('./routes/audiencias'))
app.use('/api/mediciones',        require('./routes/mediciones'))
app.use('/api/cobranza',          require('./routes/cobranza'))
app.use('/api/coaching-observado',require('./routes/coaching-observado'))
app.use('/api/import',            require('./routes/import'))

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'))
  })
}

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`))
  })
  .catch(err => {
    console.error('No se pudo inicializar la DB:', err)
    process.exit(1)
  })
