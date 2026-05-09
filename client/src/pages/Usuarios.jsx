import React, { useEffect, useState } from 'react'
import api from '../api'

const EMPTY = { name: '', email: '', password: '', role: 'staff' }

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get('/users')
    setUsers(data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setShowModal(true)
  }

  function openEdit(u) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active })
    setError('')
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role, active: form.active }
        await api.put(`/users/${editing.id}`, payload)
      } else {
        if (!form.password) return setError('La contraseña es obligatoria')
        await api.post('/users', form)
      }
      setShowModal(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(u) {
    if (!confirm(`¿Desactivar a ${u.name}?`)) return
    await api.delete(`/users/${u.id}`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button className="btn-primary btn-sm" onClick={openCreate}>+ Nuevo usuario</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.role === 'admin' ? 'bg-ecoa-100 text-ecoa-800' : 'bg-gray-100 text-gray-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.active ? 'semaforo-verde' : 'semaforo-gris'}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(u)} className="text-gray-500 hover:text-gray-700 text-xs">Editar</button>
                      {u.active && <button onClick={() => deactivate(u)} className="text-red-400 hover:text-red-600 text-xs">Desactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              {!editing && (
                <div>
                  <label className="label">Contraseña *</label>
                  <input type="password" className="input" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <p className="text-xs text-gray-400 mt-1">El usuario deberá cambiarla en el primer acceso.</p>
                </div>
              )}
              <div>
                <label className="label">Rol</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active ?? true}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Usuario activo
                </label>
              )}
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
