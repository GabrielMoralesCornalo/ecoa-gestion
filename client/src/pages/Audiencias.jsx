import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const SCALE = ['MULTIPLICO', 'SUMO', 'IGUALO', 'DIVIDO', 'RESTO']
const SCALE_LABELS = {
  MULTIPLICO: 'Multiplico', SUMO: 'Sumo', IGUALO: 'Igualo', DIVIDO: 'Divido', RESTO: 'Resto',
}
const SCALE_COLORS = {
  MULTIPLICO: 'bg-green-100 text-green-800',
  SUMO:       'bg-blue-100 text-blue-800',
  IGUALO:     'bg-gray-100 text-gray-700',
  DIVIDO:     'bg-orange-100 text-orange-800',
  RESTO:      'bg-red-100 text-red-800',
}

export default function Audiencias() {
  const { isAdmin } = useAuth()
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [teams, setTeams] = useState([])
  const [evals, setEvals] = useState([])
  const [students, setStudents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ team_id: '', date: '', career_year: 1, month_number: '', scale_result: 'IGUALO', notes: '' })
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', career_year: 1, from_month: '', to_month: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const a = r.data.find(c => c.active)
      if (a) setCohortId(String(a.id))
    })
  }, [])

  useEffect(() => {
    if (!cohortId) return
    api.get(`/audiencias/teams?cohort_id=${cohortId}`).then(r => setTeams(r.data))
    api.get(`/audiencias?cohort_id=${cohortId}`).then(r => setEvals(r.data))
    api.get(`/students?cohort_id=${cohortId}&active=true`).then(r => setStudents(r.data))
  }, [cohortId])

  async function saveEval(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      await api.post('/audiencias', { ...form, cohort_id: cohortId })
      setShowForm(false)
      setForm(f => ({ ...f, notes: '', date: '' }))
      const r = await api.get(`/audiencias?cohort_id=${cohortId}`)
      setEvals(r.data)
      setMsg('✓ Evaluación guardada')
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function createTeam() {
    if (!newTeam.name) return
    try {
      await api.post('/audiencias/teams', { ...newTeam, cohort_id: cohortId })
      setShowTeamForm(false)
      setNewTeam({ name: '', career_year: 1, from_month: '', to_month: '' })
      const r = await api.get(`/audiencias/teams?cohort_id=${cohortId}`)
      setTeams(r.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function deleteEval(id) {
    if (!confirm('¿Eliminar esta evaluación?')) return
    await api.delete(`/audiencias/${id}`)
    setEvals(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Audiencias</h1>

      <div className="flex flex-wrap gap-2">
        <select className="input w-44" value={cohortId} onChange={e => setCohortId(e.target.value)}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>+ Cargar evaluación</button>
        {isAdmin && <button className="btn-secondary btn-sm" onClick={() => setShowTeamForm(s => !s)}>+ Nuevo equipo</button>}
      </div>

      {/* Form nuevo equipo */}
      {showTeamForm && isAdmin && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Nuevo equipo</h3>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" placeholder="Nombre del equipo"
              value={newTeam.name} onChange={e => setNewTeam(f => ({ ...f, name: e.target.value }))} />
            <select className="input w-28" value={newTeam.career_year}
              onChange={e => setNewTeam(f => ({ ...f, career_year: +e.target.value }))}>
              <option value={1}>Año 1</option>
              <option value={2}>Año 2</option>
            </select>
            <input type="number" className="input w-20" placeholder="Mes ini" min={1} max={11}
              value={newTeam.from_month} onChange={e => setNewTeam(f => ({ ...f, from_month: e.target.value }))} />
            <input type="number" className="input w-20" placeholder="Mes fin" min={1} max={11}
              value={newTeam.to_month} onChange={e => setNewTeam(f => ({ ...f, to_month: e.target.value }))} />
            <button className="btn-primary btn-sm" onClick={createTeam}>Crear</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowTeamForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Equipos */}
      {teams.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-600 mb-2">Equipos</h2>
          <div className="flex flex-wrap gap-2">
            {teams.map(t => (
              <div key={t.id} className="badge bg-ecoa-100 text-ecoa-800 px-3 py-1">
                {t.name} — Año {t.career_year}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form evaluación */}
      {showForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">Nueva evaluación</h3>
          <form onSubmit={saveEval} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="label">Equipo *</label>
                <select className="input" value={form.team_id}
                  onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha *</label>
                <input type="date" className="input" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Mes</label>
                <input type="number" className="input" min={1} max={11} value={form.month_number}
                  onChange={e => setForm(f => ({ ...f, month_number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Año carrera</label>
                <select className="input" value={form.career_year}
                  onChange={e => setForm(f => ({ ...f, career_year: +e.target.value }))}>
                  <option value={1}>Año 1</option>
                  <option value={2}>Año 2</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Escala *</label>
              <div className="flex flex-wrap gap-2">
                {SCALE.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(f => ({ ...f, scale_result: s }))}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors
                      ${form.scale_result === s ? `border-current ${SCALE_COLORS[s]}` : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    {SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {msg && <p className="text-green-600 text-sm">{msg}</p>}

      {/* Historial */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b font-medium text-gray-700">Historial de evaluaciones</div>
        {evals.length === 0
          ? <p className="px-4 py-8 text-center text-gray-400 text-sm">Sin evaluaciones registradas</p>
          : <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead className="border-b">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Equipo</th>
                    <th className="px-4 py-2">Escala</th>
                    <th className="px-4 py-2 hidden sm:table-cell">Mes</th>
                    <th className="px-4 py-2 hidden md:table-cell">Evaluador</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evals.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{e.date?.slice(0,10)}</td>
                      <td className="px-4 py-2 font-medium">{e.team_name}</td>
                      <td className="px-4 py-2">
                        <span className={`badge ${SCALE_COLORS[e.scale_result]}`}>{SCALE_LABELS[e.scale_result]}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{e.month_number}</td>
                      <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{e.evaluator_name}</td>
                      <td className="px-4 py-2">
                        {isAdmin && <button onClick={() => deleteEval(e.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}
