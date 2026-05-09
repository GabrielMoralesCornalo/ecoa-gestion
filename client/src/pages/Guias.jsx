import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function Guias() {
  const { isAdmin } = useAuth()
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [month, setMonth] = useState(1)
  const [careerYear, setCareerYear] = useState(1)
  const [grid, setGrid] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [localDeliveries, setLocalDeliveries] = useState({})
  const [showNewGuide, setShowNewGuide] = useState(false)
  const [newGuide, setNewGuide] = useState({ guide_number: 1, title: '' })

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const active = r.data.find(c => c.active)
      if (active) setCohortId(String(active.id))
    })
  }, [])

  useEffect(() => {
    if (!cohortId) return
    loadGrid()
  }, [cohortId, month, careerYear])

  async function loadGrid() {
    const { data } = await api.get(`/guides/grid/${cohortId}?month_number=${month}&career_year=${careerYear}`)
    setGrid(data)
    // Inicializar state local con deliveries existentes
    const map = {}
    data.deliveries.forEach(d => {
      map[`${d.guide_id}_${d.student_id}`] = d.delivered
    })
    setLocalDeliveries(map)
  }

  function toggle(guideId, studentId) {
    const key = `${guideId}_${studentId}`
    setLocalDeliveries(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function save() {
    if (!grid) return
    setSaving(true)
    setMsg('')
    try {
      for (const guide of grid.guides) {
        const records = grid.students.map(s => ({
          student_id: s.id,
          delivered: !!localDeliveries[`${guide.id}_${s.id}`],
        }))
        await api.post(`/guides/${guide.id}/deliveries`, records)
      }
      setMsg('✓ Guardado')
    } catch {
      setMsg('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function createGuide() {
    try {
      await api.post('/guides', { cohort_id: cohortId, career_year: careerYear, month_number: month, ...newGuide })
      setShowNewGuide(false)
      setNewGuide({ guide_number: 1, title: '' })
      loadGrid()
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  async function deleteGuide(id) {
    if (!confirm('¿Eliminar esta guía?')) return
    await api.delete(`/guides/${id}`)
    loadGrid()
  }

  const maxMonths = careerYear === 1 ? 10 : 11

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Guías</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select className="input w-44" value={cohortId} onChange={e => setCohortId(e.target.value)}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-28" value={careerYear} onChange={e => setCareerYear(+e.target.value)}>
          <option value={1}>Año 1</option>
          <option value={2}>Año 2</option>
        </select>
        <select className="input w-28" value={month} onChange={e => setMonth(+e.target.value)}>
          {Array.from({ length: maxMonths }, (_, i) => (
            <option key={i+1} value={i+1}>Mes {i+1}</option>
          ))}
        </select>
        {isAdmin && (
          <button className="btn-primary btn-sm" onClick={() => setShowNewGuide(s => !s)}>+ Nueva guía</button>
        )}
      </div>

      {showNewGuide && isAdmin && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Nueva guía — Mes {month}</h3>
          <div className="flex flex-wrap gap-2">
            <select className="input w-32" value={newGuide.guide_number}
              onChange={e => setNewGuide(f => ({ ...f, guide_number: +e.target.value }))}>
              <option value={1}>Guía 1</option>
              <option value={2}>Guía 2</option>
            </select>
            <input className="input flex-1" placeholder="Título (opcional)"
              value={newGuide.title} onChange={e => setNewGuide(f => ({ ...f, title: e.target.value }))} />
            <button className="btn-primary btn-sm" onClick={createGuide}>Crear</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowNewGuide(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Grilla */}
      {!grid
        ? <div className="card text-center text-gray-400 py-12">Cargando…</div>
        : grid.guides.length === 0
          ? <div className="card text-center text-gray-400 py-12">No hay guías para este mes</div>
          : <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 min-w-40">Alumno</th>
                      {grid.guides.map(g => (
                        <th key={g.id} className="px-3 py-3 text-center font-medium text-gray-600 min-w-24">
                          <div>{g.title || `Guía ${g.guide_number}`}</div>
                          {isAdmin && (
                            <button onClick={() => deleteGuide(g.id)} className="text-red-400 hover:text-red-600 text-xs font-normal">
                              eliminar
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grid.students.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
                        {grid.guides.map(g => {
                          const key = `${g.id}_${s.id}`
                          const delivered = !!localDeliveries[key]
                          return (
                            <td key={g.id} className="px-3 py-2 text-center">
                              <button onClick={() => toggle(g.id, s.id)}
                                className={`w-8 h-8 rounded-full border-2 font-bold text-sm transition-colors
                                  ${delivered ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-300 hover:border-green-400'}`}>
                                {delivered ? '✓' : '○'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t flex items-center gap-3">
                <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                {msg && <span className="text-sm text-green-600">{msg}</span>}
              </div>
            </div>
      }
    </div>
  )
}
