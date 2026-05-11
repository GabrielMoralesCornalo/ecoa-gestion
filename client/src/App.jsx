import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Alumnos from './pages/Alumnos'
import AlumnoDetalle from './pages/AlumnoDetalle'
import Asistencia from './pages/Asistencia'
import Guias from './pages/Guias'
import Audiencias from './pages/Audiencias'
import Mediciones from './pages/Mediciones'
import Cobranza from './pages/Cobranza'
import CoachingObservado from './pages/CoachingObservado'
import Usuarios from './pages/Usuarios'
import CambiarPassword from './pages/CambiarPassword'
import Importar from './pages/Importar'
import Comisiones from './pages/Comisiones'
import Configuracion from './pages/Configuracion'

function AppRoutes() {
  const { user } = useAuth()

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Redirigir al cambio de contraseña si es necesario
  if (user.must_change_password) {
    return (
      <Routes>
        <Route path="/cambiar-password" element={<CambiarPassword />} />
        <Route path="*" element={<Navigate to="/cambiar-password" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/alumnos"       element={<Alumnos />} />
        <Route path="/alumnos/:id"   element={<AlumnoDetalle />} />
        <Route path="/asistencia"    element={<Asistencia />} />
        <Route path="/guias"         element={<Guias />} />
        <Route path="/audiencias"    element={<Audiencias />} />
        <Route path="/mediciones"    element={<Mediciones />} />
        <Route path="/coaching"      element={<CoachingObservado />} />
        <Route path="/cobranza"      element={
          <ProtectedRoute adminOnly><Cobranza /></ProtectedRoute>
        } />
        <Route path="/usuarios"      element={
          <ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>
        } />
        <Route path="/importar"      element={
          <ProtectedRoute adminOnly><Importar /></ProtectedRoute>
        } />
        <Route path="/comisiones"    element={
          <ProtectedRoute adminOnly><Comisiones /></ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute adminOnly><Configuracion /></ProtectedRoute>
        } />
        <Route path="/login"         element={<Navigate to="/" replace />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
