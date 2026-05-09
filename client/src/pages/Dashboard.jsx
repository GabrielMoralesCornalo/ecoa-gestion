import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

function StatCard({ label, value, sub, color = 'ecoa' }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-2xl font-bold text-gray-800">{value ?? '—'}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const [cohort, setCohort] = useState(null)
  const [stats, setStats] = useState(null)
  const [tutored, setTutored] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [cohortRes] = await Promise.all([api.get('/cohorts/active')])
        setCohort(cohortRes.data)

        if (cohortRes.data) {
          const cid = cohortRes.data.id
          const today = new Date()
          const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

          const [studentsRes, attendRes] = await Promise.all([
            api.get(`/students?cohort_id=${cid}&active=true`),
            api.get(`/attendance/summary/${cid}`),
          ])

          const totalStudents = studentsRes.data.length
          const attendSummary = attendRes.data
          const avgPresence = attendSummary.length > 0
            ? Math.round(attendSummary.reduce((acc, s) => {
                const total = parseInt(s.total_clases) || 0
                const pres  = parseInt(s.presentes) || 0
                return acc + (total > 0 ? pres / total : 0)
              }, 0) / attendSummary.length * 100)
            : null

          let alertas = null
          if (isAdmin) {
            try {
              const panelRes = await api.get(`/cobranza/panel?cohort_id=${cid}&month=${month}`)
              alertas = panelRes.data.filter(s => s.alert_level).length
            } catch {}
          }

          setStats({ totalStudents, avgPresence, alertas, month })
        }

        if (!isAdmin) {
          const tRes = await api.get('/students/my-tutored')
          setTutored(tRes.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin])

  if (loading) return <div className="text-gray-400 text-center py-16">Cargando…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bienvenida, {user?.name.split(' ')[0]} 👋</h1>
        {cohort && <p className="text-gray-500 text-sm mt-1">{cohort.name} — {cohort.year_started}</p>}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Alumnos activos" value={stats.totalStudents} />
          <StatCard label="Asistencia promedio" value={stats.avgPresence != null ? `${stats.avgPresence}%` : '—'} />
          {isAdmin && <StatCard label="Alertas de cobranza" value={stats.alertas ?? '—'} sub={stats.month} />}
        </div>
      )}

      {/* Accesos rápidos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Módulos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { to: '/alumnos',    icon: '👥', label: 'Alumnos' },
            { to: '/asistencia', icon: '📋', label: 'Asistencia' },
            { to: '/guias',      icon: '📚', label: 'Guías' },
            { to: '/audiencias', icon: '🎯', label: 'Audiencias' },
            { to: '/mediciones', icon: '📊', label: 'Mediciones' },
            { to: '/coaching',   icon: '🔍', label: 'Coaching Obs.' },
            ...(isAdmin ? [{ to: '/cobranza', icon: '💰', label: 'Cobranza' }] : []),
          ].map(item => (
            <Link key={item.to} to={item.to}
              className="card flex flex-col items-center gap-2 py-6 hover:bg-ecoa-50 hover:border-ecoa-200 transition-colors text-center">
              <span className="text-3xl">{item.icon}</span>
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Tutelados (staff) */}
      {!isAdmin && tutored.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Mis tutelados</h2>
          <div className="space-y-2">
            {tutored.map(s => (
              <Link key={s.id} to={`/alumnos/${s.id}`}
                className="card flex items-center justify-between hover:bg-ecoa-50 transition-colors">
                <span className="font-medium text-gray-800">{s.name}</span>
                <span className="text-xs text-ecoa-600 font-medium">Ver ficha →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
