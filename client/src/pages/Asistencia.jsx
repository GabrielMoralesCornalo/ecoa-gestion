import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Asistencia() {
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [showNewClass, setShowNewClass] = useState(false)
  const [newClass, setNewClass] = useState({ date: '', topic: '', month_number: '', career_year: 1 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const active = r.data.find(c => c.active)
      if (active) setCohortId(String(active.id))
    })
  }, [])

  useEffect(() => {
    if (!cohortId) return
    api.get(`/attendance/classes?cohort_id=${cohortId}`).then(r => setClasses(r.data))
    api.get(`/students?cohort_id=${cohortId}&active=true`).then(r => setStudents(r.data))
  }, [cohortId])

  async function selectClass(cls) {
    setSelectedClass(cls)
    const { data } = await api.get(`/attendance/${cls.id}`)
    const map = {}
    data.forEach(a => { map[a.student_id] = { present: a.present, notes: a.notes || '' } })
    // Inicializar los que no tienen registro
    students.forEach(s => {
      if (!map[s.id]) map[s.id] = { present: false, notes: '' }
    })
    setAttendance(map)
    setMsg('')
  }

  function toggle(sid) {
    setAttendance(prev => ({ ...prev, [sid]: { ...prev[sid], present: !prev[sid]?.present } }))
  }

  async function save() {
    if (!selectedClass) return
    setSaving(true)
    const records = students.map(s => ({
      student_id: s.id,
      present: attendance[s.id]?.present ?? false,
      notes: attendance[s.id]?.notes || null,
    }))
    try {
      await api.post(`/attendance/${selectedClass.id}`, records)
      setMsg('✓ Asistencia guardada')
    } catch {
      setMsg('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function createClass() {
    if (!newClass.date) return
    try {
      await api.post('/attendance/classes', { ...newClass, cohort_id: cohortId })
      setShowNewClass(false)
      setNewClass({ date: '', topic: '', month_number: '', career_year: 1 })
      const r = await api.get(`/attendance/classes?cohort_id=${cohortId}`)
      setClasses(r.data)
    } catch (err) {
      alert(err.response?.data?.error || 'Error')
    }
  }

  const presentCount = Object.values(attendance).filter(a => a.present).length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Asistencia</h1>

      <div className="flex flex-wrap gap-2">
        <select className="input w-48" value={cohortId} onChange={e => { setCohortId(e.target.value); setSelectedClass(null) }}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-primary btn-sm" onClick={() => setShowNewClass(s => !s)}>+ Nueva clase</button>
      </div>

      {showNewClass && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Nueva clase</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="label">Fecha *</label>
              <input type="date" className="input" value={newClass.date}
                onChange={e => setNewClass(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tema</label>
              <input className="input" placeholder="Ej: Escucha activa" value={newClass.topic}
                onChange={e => setNewClass(f => ({ ...f, topic: e.target.value }))} />
            </div>
            <div>
              <label className="label">Mes</label>
              <input type="number" className="input" min={1} max={11} value={newClass.month_number}
                onChange={e => setNewClass(f => ({ ...f, month_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">Año carrera</label>
              <select className="input" value={newClass.career_year}
                onChange={e => setNewClass(f => ({ ...f, career_year: +e.target.value }))}>
                <option value={1}>Año 1</option>
                <option value={2}>Año 2</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={createClass}>Crear</button>
            <button className="btn-secondary btn-sm" onClick={() => setShowNewClass(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Lista de clases */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-gray-700 bg-gray-50">Clases</div>
          {classes.length === 0
            ? <p className="px-4 py-4 text-gray-400 text-sm">Sin clases registradas</p>
            : <div className="divide-y max-h-96 overflow-y-auto">
                {classes.map(cl => (
                  <button key={cl.id} onClick={() => selectClass(cl)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                      ${selectedClass?.id === cl.id ? 'bg-ecoa-50 border-r-2 border-ecoa-500' : ''}`}>
                    <div className="font-medium">{cl.date?.slice(0,10)}</div>
                    <div className="text-gray-400 text-xs">{cl.topic || 'Sin tema'}</div>
                  </button>
                ))}
              </div>
          }
        </div>

        {/* Carga de asistencia */}
        <div className="md:col-span-2">
          {!selectedClass
            ? <div className="card text-center text-gray-400 py-12">Seleccioná una clase</div>
            : <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{selectedClass.date?.slice(0,10)}</h3>
                    <p className="text-sm text-gray-400">{selectedClass.topic}</p>
                  </div>
                  <span className="badge bg-ecoa-100 text-ecoa-700">{presentCount}/{students.length} presentes</span>
                </div>

                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {students.map(s => (
                    <button key={s.id} onClick={() => toggle(s.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors
                        ${attendance[s.id]?.present ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                      <span className="font-medium">{s.name}</span>
                      <span>{attendance[s.id]?.present ? '✓ Presente' : '○ Ausente'}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button className="btn-primary" onClick={save} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar asistencia'}
                  </button>
                  {msg && <span className="text-sm text-green-600">{msg}</span>}
                </div>
              </div>
          }
        </div>
      </div>
    </div>
  )
}
