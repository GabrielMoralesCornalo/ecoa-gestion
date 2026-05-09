import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

const EVAL_LABELS = {
  NO_ALCANZO: 'No alcanzó',
  ALCANZO: 'Alcanzó',
  ALCANZO_SATISFACTORIAMENTE: 'Alcanzó satisfact.',
  SUPERO: 'Superó',
}
const EVAL_COLORS = {
  NO_ALCANZO: 'semaforo-rojo',
  ALCANZO: 'semaforo-amarillo',
  ALCANZO_SATISFACTORIAMENTE: 'semaforo-verde',
  SUPERO: 'semaforo-verde',
}

function Section({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card">
      <button className="w-full flex items-center justify-between font-semibold text-gray-800 text-left"
        onClick={() => setOpen(o => !o)}>
        {title}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

export default function AlumnoDetalle() {
  const { id } = useParams()
  const [ficha, setFicha] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/students/${id}/ficha`).then(r => {
      setFicha(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>
  if (!ficha) return <div className="text-center py-16 text-gray-400">Alumno no encontrado</div>

  const { student: s, attendance, guides, mediciones, co_fase1, co_fase2, co_fase3_sessions, co_fase3_submissions, payments } = ficha

  const presentes = attendance.filter(a => a.present).length
  const totalClases = attendance.length
  const pctAsist = totalClases > 0 ? Math.round(presentes / totalClases * 100) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/alumnos" className="text-gray-400 hover:text-gray-600 text-sm">← Alumnos</Link>
      </div>

      {/* Cabecera */}
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
          <span>📚 {s.cohort_name}</span>
          <span>🎓 Año {s.career_year}</span>
          {s.phone && <span>📞 {s.phone}</span>}
          {s.email && <span>✉️ {s.email}</span>}
          {s.tutor_y1_name && <span>👤 Tutor 1: {s.tutor_y1_name}</span>}
          {s.tutor_y2_name && <span>👤 Tutor 2: {s.tutor_y2_name}</span>}
        </div>
      </div>

      {/* Asistencia */}
      <Section title={`📋 Asistencia ${pctAsist != null ? `— ${pctAsist}%` : ''}`}>
        {attendance.length === 0
          ? <p className="text-gray-400 text-sm">Sin registros</p>
          : <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead><tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Tema</th>
                  <th className="py-1">Estado</th>
                </tr></thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-1 pr-3 text-gray-600">{a.date?.slice(0,10)}</td>
                      <td className="py-1 pr-3 text-gray-600">{a.topic || '—'}</td>
                      <td className="py-1">
                        <span className={a.present ? 'semaforo-verde' : 'semaforo-rojo'}>
                          {a.present ? 'Presente' : 'Ausente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Section>

      {/* Guías */}
      <Section title="📚 Guías">
        {guides.length === 0
          ? <p className="text-gray-400 text-sm">Sin registros</p>
          : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {guides.map(g => (
                <div key={g.id} className={`p-2 rounded-lg border text-sm ${g.delivered ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="font-medium">{g.title || `Guía ${g.guide_number}`}</div>
                  <div className="text-xs text-gray-500">Mes {g.month_number}</div>
                  <div className={`mt-1 text-xs font-medium ${g.delivered ? 'text-green-700' : 'text-gray-400'}`}>
                    {g.delivered ? '✓ Entregada' : '○ Pendiente'}
                  </div>
                </div>
              ))}
            </div>
        }
      </Section>

      {/* Mediciones */}
      <Section title="📊 Mediciones">
        {mediciones.length === 0
          ? <p className="text-gray-400 text-sm">Sin registros</p>
          : <div className="space-y-2">
              {mediciones.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{m.title || `Medición ${m.number}`}</span>
                    <span className="text-xs text-gray-400 ml-2">Año {m.career_year}</span>
                  </div>
                  <span className="text-lg font-bold text-ecoa-700">{m.grade ?? '—'}</span>
                </div>
              ))}
            </div>
        }
      </Section>

      {/* Coaching Observado */}
      <Section title="🔍 Coaching Observado">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">Fase 1 — como coachee: {co_fase1.length} sesiones</p>
            {co_fase1.length < 2 && <span className="semaforo-amarillo text-xs">⚠️ Mínimo 2 requeridas</span>}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Fase 2 — como coach: {co_fase2.filter(s => s.student_coach_id === parseInt(id)).length} sesiones
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Fase 3 — {co_fase3_sessions.length}/24 sesiones
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-ecoa-500 rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, co_fase3_sessions.length / 24 * 100)}%` }} />
            </div>
            {co_fase3_submissions.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-gray-500 border-b">
                    <th className="py-1 pr-2 text-left">Domingo</th>
                    <th className="py-1 pr-2 text-center">Obs 1</th>
                    <th className="py-1 pr-2 text-center">Obs 2</th>
                    <th className="py-1 pr-2 text-center">Video</th>
                    <th className="py-1 text-left">Evaluación</th>
                  </tr></thead>
                  <tbody>
                    {co_fase3_submissions.map(sub => (
                      <tr key={sub.id} className="border-b last:border-0">
                        <td className="py-1 pr-2">{sub.sunday_date?.slice(0,10)}</td>
                        <td className="py-1 pr-2 text-center">{sub.auto_obs_1 ? '✓' : '○'}</td>
                        <td className="py-1 pr-2 text-center">{sub.auto_obs_2 ? '✓' : '○'}</td>
                        <td className="py-1 pr-2 text-center">{sub.video_submitted ? '✓' : '—'}</td>
                        <td className="py-1">
                          {sub.tutor_eval
                            ? <span className={EVAL_COLORS[sub.tutor_eval]}>{EVAL_LABELS[sub.tutor_eval]}</span>
                            : <span className="text-gray-300">Sin evaluar</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Pagos */}
      {payments.length > 0 && (
        <Section title="💰 Pagos">
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-3">Mes</th>
                <th className="py-1 pr-3">Monto</th>
                <th className="py-1 pr-3">Fecha pago</th>
                <th className="py-1">Método</th>
              </tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-1 pr-3">{p.month}</td>
                    <td className="py-1 pr-3">${p.amount_paid?.toLocaleString('es-AR') ?? '—'}</td>
                    <td className="py-1 pr-3">{p.paid_date?.slice(0,10) ?? '—'}</td>
                    <td className="py-1 text-gray-500">{p.method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
