import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/',                 label: 'Dashboard',          icon: '🏠', adminOnly: false },
  { to: '/alumnos',          label: 'Alumnos',            icon: '👥', adminOnly: false },
  { to: '/asistencia',       label: 'Asistencia',         icon: '📋', adminOnly: false },
  { to: '/guias',            label: 'Guías',              icon: '📚', adminOnly: false },
  { to: '/audiencias',       label: 'Audiencias',         icon: '🎯', adminOnly: false },
  { to: '/mediciones',       label: 'Mediciones',         icon: '📊', adminOnly: false },
  { to: '/coaching',         label: 'Coaching Observado', icon: '🔍', adminOnly: false },
  { to: '/cobranza',         label: 'Cobranza',           icon: '💰', adminOnly: true  },
  { to: '/usuarios',         label: 'Usuarios',           icon: '⚙️',  adminOnly: true  },
]

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-ecoa-700 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1" onClick={() => setMenuOpen(o => !o)}>
              <span className="text-xl">☰</span>
            </button>
            <span className="font-bold tracking-wide text-lg">ECOA Gestión</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline opacity-75">{user?.name}</span>
            <span className="badge bg-ecoa-500 text-white capitalize">{user?.role}</span>
            <button onClick={handleLogout} className="ml-2 opacity-75 hover:opacity-100 text-xs underline">
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 pt-4 shrink-0">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                ${location.pathname === item.to
                  ? 'bg-ecoa-50 text-ecoa-700 border-r-2 border-ecoa-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sidebar mobile */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <nav className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl pt-4"
              onClick={e => e.stopPropagation()}>
              <div className="px-4 py-2 font-bold text-ecoa-700 text-lg border-b mb-2">ECOA</div>
              {items.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors
                    ${location.pathname === item.to
                      ? 'bg-ecoa-50 text-ecoa-700'
                      : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
