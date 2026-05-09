import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

const EVAL_OPTIONS = ['NO_ALCANZO', 'ALCANZO', 'ALCANZO_SATISFACTORIAMENTE', 'SUPERO']
const EVAL_LABELS  = { NO_ALCANZO: 'No alcanzó', ALCANZO: 'Alcanzó', ALCANZO_SATISFACTORIAMENTE: 'Alcanzó satisf.', SUPERO: 'Superó' }
const EVAL_COLORS  = { NO_ALCANZO: 'semaforo-rojo', ALCANZO: 'semaforo-amarillo', ALCANZO_SATISFACTORIAMENTE: 'semaforo-verde', SUPERO: 'semaforo-verde' }

function SemaforoMin({ count, min = 2, label }) {
  const ok = count >= min
  return (
    <span className={ok ? 'semaforo-verde' : 'semaforo-rojo'}>
      {count}/{min} {label}
    </span>
  )
}

export default function CoachingObservado() {
  const { isAdmin, user } = useAuth()
  const [tab, setTab] = useState('fase1')
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [students, setStudents] = useState([])
  const [users, setUsers] = useState([])

  // Fase 1
  const [f1Sessions, setF1Sessions] = useState([])
  const [f1Summary, setF1Summary] = useState([])
  const [f1Form, setF1Form] = useState({ date: '', coach_id: '', student_id: '', notes: '' })

  // Fase 2
  const [f2Sessions, setF2Sessions] = useState([])
  const [f2Summary, setF2Summary] = useState([])
  const [f2Form, setF2Form] = useState({ date: '', student_coach_id: '', student_coachee_id: '', notes: '' })

  // Fase 3
  const [f3Student, setF3Student] = useState('')
  const [f3Sessions, setF3Sessions] = useState([])
  const [f3Submissions, setF3Submissions] = useState([])
  const [f3Form, setF3Form] = useState({ session_number: '', date: '', coachee_name: '', notes: '' })
  const [f3SubForm, setF3SubForm] = useState({
    sunday_date: '', auto_obs_1: false, auto_obs_2: false,
    video_submitted: false, tutor_eval: '', tutor_id: '', eval_date: '', notes: ''
  })

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const a = r.data.find(c => c.active)
      if (a) setCohortId(String(a.id))
    })
    api.get('/users/staff').then(r => setUsers(r.data))
  }, [])

  useEffect(() => {
    if (!cohortId) return
    api.get(`/students?cohort_id=${cohortId}&active=true`).then(r => setStudents(r.data))
    loadFase1()
    loadFase2()
  }, [cohortId])

  useEffect(() => {
    if (f3Student) loadFase3()
  }, [f3Student])

  async function loadFase1() {
    const [sessions, summary] = await Promise.all([
      api.get(`/coaching-observado/fase1?cohort_id=${cohortId}`),
      api.get(`/coaching-observado/fase1/summary/${cohortId}`),
    ])
    setF1Sessions(sessions.data)
    setF1Summary(summary.data)
  }

  async function loadFase2() {
    const [sessions, summary] = await Promise.all([
      api.get(`/coaching-observado/fase2?cohort_id=${cohortId}`),
      api.get(`/coaching-observado/fase2/summary/${cohortId}`),
    ])
    setF2Sessions(sessions.data)
    setF2Summary(summary.data)
  }

  async function loadFase3() {
    const [sess, subs] = await Promise.all([
      api.get(`/coaching-observado/fase3/sessions?student_id=${f3Student}`),
      api.get(`/coaching-observado/fase3/submissions?student_id=${f3Student}`),
    ])
    setF3Sessions(sess.data)
    setF3Submissions(subs.data)
  }

  async function saveF1(e) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.post('/coaching-observado/fase1', { ...f1Form, cohort_id: cohortId })
      setF1Form(f => ({ ...f, date: '', notes: '' }))
      setMsg('✓ Sesión registrada')
      loadFase1()
    } catch (err) { setMsg(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  async function saveF2(e) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.post('/coaching-observado/fase2', { ...f2Form, cohort_id: cohortId })
      setF2Form(f => ({ ...f, date: '', notes: '' }))
      setMsg('✓ Sesión registrada')
      loadFase2()
    } catch (err) { setMsg(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  async function saveF3Session(e) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.post('/coaching-observado/fase3/sessions', { ...f3Form, student_id: f3Student })
      setF3Form({ session_number: '', date: '', coachee_name: '', notes: '' })
      setMsg('✓ Sesión registrada')
      loadFase3()
    } catch (err) { setMsg(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  async function saveF3Sub(e) {
    e.preventDefault(); setSaving(true); setMsg('')
    try {
      await api.post('/coaching-observado/fase3/submissions', { ...f3SubForm, student_id: f3Student })
      setF3SubForm({ sunday_date: '', auto_obs_1: false, auto_obs_2: false, video_submitted: false, tutor_eval: '', tutor_id: '', eval_date: '', notes: '' })
      setMsg('✓ Entrega registrada')
      loadFase3()
    } catch (err) { setMsg(err.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'fase1', label: 'Fase 1' },
    { id: 'fase2', label: 'Fase 2' },
    { id: 'fase3', label: 'Fase 3' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Coaching Observado</h1>

      <div className="flex flex-wrap gap-2">
        <select className="input w-44" value={cohortId} onChange={e => { setCohortId(e.target.value) }}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setMsg('') }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${tab === t.id ? 'border-ecoa-600 text-ecoa-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-green-600 text-sm">{msg}</p>}

      {/* ─── FASE 1 ─── */}
      {tab === 'fase1' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Sesiones del staff hacia los alumnos como coachees. Mínimo 2 por alumno.</p>

          {/* Semáforo */}
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-2">Estado por alumno</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {f1Summary.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <span className="truncate">{s.name}</span>
                  <SemaforoMin count={parseInt(s.sesiones_como_coachee)} min={2} label="ses." />
                </div>
              ))}
            </div>
          </div>

          {/* Formulario */}
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-3">Registrar sesión</h3>
            <form onSubmit={saveF1} className="flex flex-wrap gap-2">
              <input type="date" className="input w-36" value={f1Form.date}
                onChange={e => setF1Form(f => ({ ...f, date: e.target.value }))} required />
              <select className="input flex-1" value={f1Form.coach_id}
                onChange={e => setF1Form(f => ({ ...f, coach_id: e.target.value }))}>
                <option value="">Coach (staff) *</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className="input flex-1" value={f1Form.student_id}
                onChange={e => setF1Form(f => ({ ...f, student_id: e.target.value }))} required>
                <option value="">Alumno coachee *</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input className="input flex-1" placeholder="Notas" value={f1Form.notes}
                onChange={e => setF1Form(f => ({ ...f, notes: e.target.value }))} />
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>Guardar</button>
            </form>
          </div>

          {/* Historial */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b font-medium text-gray-700">Sesiones registradas</div>
            {f1Sessions.length === 0
              ? <p className="px-4 py-6 text-center text-gray-400 text-sm">Sin sesiones</p>
              : <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead><tr className="text-gray-500 border-b text-left">
                      <th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Coach</th>
                      <th className="px-4 py-2">Alumno coachee</th>
                      {isAdmin && <th className="px-4 py-2"></th>}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {f1Sessions.map(s => (
                        <tr key={s.id}>
                          <td className="px-4 py-2">{s.date?.slice(0,10)}</td>
                          <td className="px-4 py-2">{s.coach_name}</td>
                          <td className="px-4 py-2">{s.student_name}</td>
                          {isAdmin && <td className="px-4 py-2">
                            <button onClick={async () => { await api.delete(`/coaching-observado/fase1/${s.id}`); loadFase1() }}
                              className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      )}

      {/* ─── FASE 2 ─── */}
      {tab === 'fase2' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Sesiones entre alumnos. Cada alumno debe actuar como coach mínimo 2 veces.</p>

          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-2">Estado por alumno</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {f2Summary.map(s => (
                <div key={s.id} className="p-2 bg-gray-50 rounded text-sm">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    <SemaforoMin count={parseInt(s.sesiones_como_coach)} min={2} label="coach" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-3">Registrar sesión</h3>
            <form onSubmit={saveF2} className="flex flex-wrap gap-2">
              <input type="date" className="input w-36" value={f2Form.date}
                onChange={e => setF2Form(f => ({ ...f, date: e.target.value }))} required />
              <select className="input flex-1" value={f2Form.student_coach_id}
                onChange={e => setF2Form(f => ({ ...f, student_coach_id: e.target.value }))} required>
                <option value="">Alumno coach *</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input flex-1" value={f2Form.student_coachee_id}
                onChange={e => setF2Form(f => ({ ...f, student_coachee_id: e.target.value }))} required>
                <option value="">Alumno coachee *</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>Guardar</button>
            </form>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b font-medium text-gray-700">Sesiones registradas</div>
            {f2Sessions.length === 0
              ? <p className="px-4 py-6 text-center text-gray-400 text-sm">Sin sesiones</p>
              : <div className="overflow-x-auto">
                  <table className="text-sm w-full">
                    <thead><tr className="text-gray-500 border-b text-left">
                      <th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Coach</th>
                      <th className="px-4 py-2">Coachee</th>
                      {isAdmin && <th className="px-4 py-2"></th>}
                    </tr></thead>
                    <tbody className="divide-y">
                      {f2Sessions.map(s => (
                        <tr key={s.id}>
                          <td className="px-4 py-2">{s.date?.slice(0,10)}</td>
                          <td className="px-4 py-2">{s.coach_name}</td>
                          <td className="px-4 py-2">{s.coachee_name}</td>
                          {isAdmin && <td className="px-4 py-2">
                            <button onClick={async () => { await api.delete(`/coaching-observado/fase2/${s.id}`); loadFase2() }}
                              className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>
      )}

      {/* ─── FASE 3 ─── */}
      {tab === 'fase3' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">24 sesiones con coachees externos + entregas de domingos.</p>

          <div>
            <label className="label">Alumno</label>
            <select className="input w-64" value={f3Student} onChange={e => setF3Student(e.target.value)}>
              <option value="">Seleccionar alumno…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {f3Student && (
            <div className="space-y-4">
              {/* Progreso sesiones */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-700">Sesiones externas</h3>
                  <span className="text-sm font-bold text-ecoa-700">{f3Sessions.length}/24</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                  <div className="bg-ecoa-500 rounded-full h-3 transition-all"
                    style={{ width: `${Math.min(100, f3Sessions.length / 24 * 100)}%` }} />
                </div>
                <form onSubmit={saveF3Session} className="flex flex-wrap gap-2">
                  <input type="number" className="input w-20" placeholder="#" min={1} max={24}
                    value={f3Form.session_number} onChange={e => setF3Form(f => ({ ...f, session_number: e.target.value }))} />
                  <input type="date" className="input w-36" value={f3Form.date}
                    onChange={e => setF3Form(f => ({ ...f, date: e.target.value }))} />
                  <input className="input flex-1" placeholder="Nombre del coachee externo"
                    value={f3Form.coachee_name} onChange={e => setF3Form(f => ({ ...f, coachee_name: e.target.value }))} />
                  <button type="submit" className="btn-primary btn-sm" disabled={saving}>+ Sesión</button>
                </form>
                {f3Sessions.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="text-xs w-full mt-1">
                      <thead><tr className="text-gray-400 border-b">
                        <th className="py-1 pr-3 text-left">#</th>
                        <th className="py-1 pr-3 text-left">Fecha</th>
                        <th className="py-1 text-left">Coachee</th>
                      </tr></thead>
                      <tbody>
                        {f3Sessions.map(s => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-1 pr-3 font-bold text-ecoa-700">{s.session_number}</td>
                            <td className="py-1 pr-3">{s.date?.slice(0,10)}</td>
                            <td className="py-1">{s.coachee_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Entregas dominicales */}
              <div className="card">
                <h3 className="font-semibold text-gray-700 mb-3">Entregas dominicales</h3>
                <form onSubmit={saveF3Sub} className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div>
                      <label className="label">Domingo *</label>
                      <input type="date" className="input w-36" value={f3SubForm.sunday_date}
                        onChange={e => setF3SubForm(f => ({ ...f, sunday_date: e.target.value }))} required />
                    </div>
                    <div className="flex gap-4 pt-5">
                      {[['auto_obs_1','Obs. 1'],['auto_obs_2','Obs. 2'],['video_submitted','Video']].map(([k,l]) => (
                        <label key={k} className="flex items-center gap-1 text-sm cursor-pointer">
                          <input type="checkbox" checked={f3SubForm[k]}
                            onChange={e => setF3SubForm(f => ({ ...f, [k]: e.target.checked }))} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="input flex-1" value={f3SubForm.tutor_eval}
                      onChange={e => setF3SubForm(f => ({ ...f, tutor_eval: e.target.value }))}>
                      <option value="">Sin evaluación</option>
                      {EVAL_OPTIONS.map(o => <option key={o} value={o}>{EVAL_LABELS[o]}</option>)}
                    </select>
                    <select className="input flex-1" value={f3SubForm.tutor_id}
                      onChange={e => setF3SubForm(f => ({ ...f, tutor_id: e.target.value }))}>
                      <option value="">Tutor evaluador</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <input type="date" className="input w-36" value={f3SubForm.eval_date}
                      onChange={e => setF3SubForm(f => ({ ...f, eval_date: e.target.value }))} />
                  </div>
                  <button type="submit" className="btn-primary btn-sm" disabled={saving}>Guardar entrega</button>
                </form>

                {f3Submissions.length > 0 && (
                  <div className="overflow-x-auto mt-3">
                    <table className="text-xs w-full">
                      <thead><tr className="text-gray-400 border-b">
                        <th className="py-1 pr-2 text-left">Domingo</th>
                        <th className="py-1 pr-2 text-center">Obs1</th>
                        <th className="py-1 pr-2 text-center">Obs2</th>
                        <th className="py-1 pr-2 text-center">Video</th>
                        <th className="py-1 text-left">Evaluación</th>
                      </tr></thead>
                      <tbody>
                        {f3Submissions.map(s => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-1 pr-2">{s.sunday_date?.slice(0,10)}</td>
                            <td className="py-1 pr-2 text-center">{s.auto_obs_1 ? '✓' : '○'}</td>
                            <td className="py-1 pr-2 text-center">{s.auto_obs_2 ? '✓' : '○'}</td>
                            <td className="py-1 pr-2 text-center">{s.video_submitted ? '✓' : '—'}</td>
                            <td className="py-1">
                              {s.tutor_eval
                                ? <span className={EVAL_COLORS[s.tutor_eval]}>{EVAL_LABELS[s.tutor_eval]}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
