import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

const EMPTY = { name: '', phone: '', email: '', career_year: 1, cohort_id: '', tutor_y1_id: '', tutor_y2_id: '' }

export default function Alumnos() {
  const { isAdmin } = useAuth()
  const [students, setStudents] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [filterCohort, setFilterCohort] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [sRes, cRes, uRes] = await Promise.all([
      api.get('/students?active=true'),
      api.get('/cohorts'),
      api.get('/users/staff'),
    ])
    setStudents(sRes.data)
    setCohorts(cRes.data)
    setUsers(uRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
    const matchCohort = !filterCohort || String(s.cohort_id) === filterCohort
    return matchSearch && matchCohort
  })

  function openCreate() {
    setEditing(null)
    const defaultCohort = cohorts.find(c => c.active)
    setForm({ ...EMPTY, cohort_id: defaultCohort?.id || '' })
    setError('')
    setShowModal(true)
  }

  function openEdit(s) {
    setEditing(s)
    setForm({
      name: s.name, phone: s.phone || '', email: s.email || '',
      career_year: s.career_year, cohort_id: s.cohort_id,
      tutor_y1_id: s.tutor_y1_id || '', tutor_y2_id: s.tutor_y2_id || '',
      active: s.active,
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name || !form.cohort_id) return setError('Nombre y comisión son obligatorios')
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, { ...form, active: form.active ?? true })
      } else {
        await api.post('/students', form)
      }
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s) {
    if (!confirm(`¿Desactivar a ${s.name}?`)) return
    await api.delete(`/students/${s.id}`)
    load()
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Cargando…</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Alumnos</h1>
        {isAdmin && <button className="btn-primary btn-sm" onClick={openCreate}>+ Nuevo alumno</button>}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input" placeholder="Buscar por nombre o email…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input sm:w-48" value={filterCohort} onChange={e => setFilterCohort(e.target.value)}>
          <option value="">Todas las comisiones</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Comisión</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Año</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Tutor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin alumnos</td></tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/alumnos/${s.id}`} className="hover:text-ecoa-600">{s.name}</Link>
                    <div className="text-xs text-gray-400 sm:hidden">{s.cohort_name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{s.cohort_name}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">Año {s.career_year}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {s.career_year === 1 ? s.tutor_y1_name : s.tutor_y2_name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/alumnos/${s.id}`} className="text-ecoa-600 hover:underline text-xs">Ver</Link>
                      {isAdmin && <>
                        <button onClick={() => openEdit(s)} className="text-gray-500 hover:text-gray-700 text-xs">Editar</button>
                        <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700 text-xs">Desactivar</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">{filtered.length} alumno{filtered.length !== 1 ? 's' : ''}</p>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar alumno' : 'Nuevo alumno'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Comisión *</label>
                <select className="input" value={form.cohort_id} onChange={e => setForm(f => ({ ...f, cohort_id: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Año de carrera</label>
                <select className="input" value={form.career_year} onChange={e => setForm(f => ({ ...f, career_year: +e.target.value }))}>
                  <option value={1}>Año 1</option>
                  <option value={2}>Año 2</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Tutor Año 1</label>
              <select className="input" value={form.tutor_y1_id} onChange={e => setForm(f => ({ ...f, tutor_y1_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tutor Año 2</label>
              <select className="input" value={form.tutor_y2_id} onChange={e => setForm(f => ({ ...f, tutor_y2_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active ?? true}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                <label htmlFor="active" className="text-sm text-gray-700">Alumno activo</label>
              </div>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
