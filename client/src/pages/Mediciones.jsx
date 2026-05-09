import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function Mediciones() {
  const { isAdmin } = useAuth()
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [mediciones, setMediciones] = useState([])
  const [selected, setSelected] = useState(null)
  const [results, setResults] = useState([])
  const [students, setStudents] = useState([])
  const [localGrades, setLocalGrades] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newMed, setNewMed] = useState({ career_year: 1, number: 1, date: '', title: '' })

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const a = r.data.find(c => c.active)
      if (a) setCohortId(String(a.id))
    })
  }, [])

  useEffect(() => {
    if (!cohortId) return
    api.get(`/mediciones?cohort_id=${cohortId}`).then(r => setMediciones(r.data))
    api.get(`/students?cohort_id=${cohortId}&active=true`).then(r => setStudents(r.data))
  }, [cohortId])

  async function selectMed(m) {
    setSelected(m)
    const { data } = await api.get(`/mediciones/${m.id}/results`)
    setResults(data)
    const map = {}
    data.forEach(r => { map[r.student_id] = { grade: r.grade, notes: r.notes || '' } })
    setLocalGrades(map)
    setMsg('')
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    const records = students.map(s => ({
      student_id: s.id,
      grade: localGrades[s.id]?.grade != null ? parseFloat(localGrades[s.id].grade) : null,
      notes: localGrades[s.id]?.notes || null,
    })).filter(r => r.grade != null)
    try {
      await api.post(`/mediciones/${selected.id}/results`, records)
      setMsg('✓ Notas guardadas')
    } catch {
      setMsg('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function createMed() {
    try {
      await api.post('/mediciones', { ...newMed, cohort_id: cohortId })
      setShowNew(false)
      setNewMed({ career_year: 1, number: 1, date: '', title: '' })
      const r = await api.get(`/mediciones?cohort_id=${cohortId}`)
      setMediciones(r.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function deleteMed(m) {
    if (!confirm(`¿Eliminar "${m.title}"?`)) return
    await api.delete(`/mediciones/${m.id}`)
    setMediciones(prev => prev.filter(x => x.id !== m.id))
    if (selected?.id === m.id) setSelected(null)
  }

  const avg = selected && results.length > 0
    ? (results.reduce((a, r) => a + r.grade, 0) / results.length).toFixed(1)
    : null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Mediciones de Entendimiento</h1>

      <div className="flex flex-wrap gap-2">
        <select className="input w-44" value={cohortId} onChange={e => { setCohortId(e.target.value); setSelected(null) }}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isAdmin && <button className="btn-primary btn-sm" onClick={() => setShowNew(s => !s)}>+ Nueva medición</button>}
      </div>

      {showNew && isAdmin && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Nueva medición</h3>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" placeholder="Título (ej: Medición 1 — Año 1)"
              value={newMed.title} onChange={e => setNewMed(f => ({ ...f, title: e.target.value }))} />
            <select className="input w-28" value={newMed.career_year}
              onChange={e => setNewMed(f => ({ ...f, career_year: +e.target.value }))}>
              <option value={1}>Año 1</option>
              <option value={2}>Año 2</option>
            </select>
            <select className="input w-24" value={newMed.number}
              onChange={e => setNewMed(f => ({ ...f, number: +e.target.value }))}>
              <option value={1}>1ra</option>
              <option value={2}>2da</option>
            </select>
            <input type="date" className="input w-36" value={newMed.date}
              onChange={e => setNewMed(f => ({ ...f, date: e.target.value }))} />
            <button className="btn-primary btn-sm" onClick={createMed}>Crear</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowNew(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Lista mediciones */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b font-medium text-gray-700">Mediciones</div>
          {mediciones.length === 0
            ? <p className="px-4 py-8 text-center text-gray-400 text-sm">Sin mediciones</p>
            : <div className="divide-y max-h-96 overflow-y-auto">
                {mediciones.map(m => (
                  <div key={m.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50
                    ${selected?.id === m.id ? 'bg-ecoa-50 border-r-2 border-ecoa-500' : ''}`}
                    onClick={() => selectMed(m)}>
                    <div>
                      <div className="text-sm font-medium">{m.title || `Medición ${m.number}`}</div>
                      <div className="text-xs text-gray-400">Año {m.career_year} — {m.date?.slice(0,10) || 'Sin fecha'}</div>
                    </div>
                    {isAdmin && (
                      <button onClick={e => { e.stopPropagation(); deleteMed(m) }}
                        className="text-red-400 hover:text-red-600 text-xs">×</button>
                    )}
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Carga de notas */}
        <div className="md:col-span-2">
          {!selected
            ? <div className="card text-center text-gray-400 py-12">Seleccioná una medición</div>
            : <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{selected.title || `Medición ${selected.number}`}</h3>
                  {avg && <span className="text-sm text-gray-500">Promedio: <strong>{avg}</strong></span>}
                </div>

                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                      <span className="flex-1 text-sm font-medium text-gray-800">{s.name}</span>
                      <input
                        type="number" min={0} max={10} step={0.1}
                        className="input w-20 text-center font-bold"
                        placeholder="0–10"
                        value={localGrades[s.id]?.grade ?? ''}
                        onChange={e => setLocalGrades(prev => ({
                          ...prev,
                          [s.id]: { ...prev[s.id], grade: e.target.value === '' ? null : +e.target.value }
                        }))}
                        disabled={!isAdmin}
                      />
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-3 pt-1">
                    <button className="btn-primary" onClick={save} disabled={saving}>
                      {saving ? 'Guardando…' : 'Guardar notas'}
                    </button>
                    {msg && <span className="text-sm text-green-600">{msg}</span>}
                  </div>
                )}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
