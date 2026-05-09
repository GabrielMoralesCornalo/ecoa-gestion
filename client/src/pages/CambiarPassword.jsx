import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function CambiarPassword() {
  const { refreshUser, logout } = useAuth()
  const [form, setForm] = useState({ new_password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.new_password !== form.confirm) return setError('Las contraseñas no coinciden')
    if (form.new_password.length < 6) return setError('Mínimo 6 caracteres')
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/change-password', { new_password: form.new_password })
      await refreshUser()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ecoa-800 to-ecoa-600 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Cambiar contraseña</h1>
          <p className="text-ecoa-200 mt-1">Debés establecer una nueva contraseña antes de continuar.</p>
        </div>
        <div className="card shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres"
                value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                autoFocus required />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input type="password" className="input" placeholder="Repetí la contraseña"
                value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        </div>
        <button onClick={logout} className="block text-center w-full text-ecoa-300 text-xs mt-4 hover:text-white">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
