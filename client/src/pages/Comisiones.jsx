import React, { useEffect, useState } from 'react'
import api from '../api'

const EMPTY = { name: '', year_started: new Date().getFullYear(), active: true }

export default function Comisiones() {
  const [cohorts, setCohorts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/cohorts')
    setCohorts(data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, year_started: c.year_started, active: c.active })
    setError('')
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.put(`/cohorts/${editing.id}`, form)
      } else {
        await api.post('/cohorts', form)
      }
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Comisiones</h1>
        <button className="btn-primary btn-sm" onClick={openCreate}>+ Nueva comisión</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="text-sm w-full">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Año inicio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cohorts.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.year_started}</td>
                <td className="px-4 py-3">
                  <span className={c.active ? 'semaforo-verde' : 'semaforo-gris'}>
                    {c.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="text-gray-500 hover:text-gray-700 text-xs">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {cohorts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Sin comisiones</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{editing ? 'Editar comisión' : 'Nueva comisión'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Ej: Comisión 2027" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Año de inicio *</label>
                <input type="number" className="input" value={form.year_started}
                  onChange={e => setForm(f => ({ ...f, year_started: parseInt(e.target.value) }))} required />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Comisión activa
              </label>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
