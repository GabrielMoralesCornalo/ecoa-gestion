import React, { useEffect, useRef, useState } from 'react'
import api from '../api'

const TABS = [
  { key: 'students', label: 'Alumnos' },
  { key: 'classes',  label: 'Fechas de clases' },
  { key: 'guides',   label: 'Guías' },
]

const TEMPLATES = {
  students: {
    headers: ['Nombre', 'Email', 'Teléfono', 'DNI', 'Comisión', 'Año'],
    example:  ['María García', 'maria@gmail.com', '3794123456', '35000000', 'Comisión 2026', '1'],
    hint: 'La columna "Comisión" debe coincidir exactamente con el nombre de una comisión ya creada en el sistema. Si el email ya existe, actualiza el alumno.',
  },
  classes: {
    headers: ['Comisión', 'Fecha', 'Año', 'Mes', 'Tema'],
    example:  ['Comisión 2026', '2026-03-15', '1', '1', 'Introducción al Coaching Ontológico'],
    hint: 'La Fecha debe estar en formato YYYY-MM-DD (ej: 2026-03-15). Mes y Año son números de módulo.',
  },
  guides: {
    headers: ['Comisión', 'Año', 'Mes', 'Guía N°', 'Título'],
    example:  ['Comisión 2026', '1', '1', '1', 'Guía de Ontología del Lenguaje'],
    hint: 'Si la combinación Comisión+Año+Mes+Guía N° ya existe, actualiza el título.',
  },
}

function downloadTemplate(type) {
  const t = TEMPLATES[type]
  const rows = [t.headers, t.example]
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plantilla_${type}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Importar() {
  const [tab, setTab] = useState('students')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    setFile(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [tab])

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await api.post(`/import/${tab}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (err) {
      setResult({ ok: 0, errors: [err.response?.data?.error || 'Error al importar'] })
    } finally {
      setLoading(false)
    }
  }

  const t = TEMPLATES[tab]

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">Importar desde Excel</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-ecoa-600 text-ecoa-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Instrucciones */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-700">Columnas requeridas</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {t.headers.map(h => (
                <span key={h} className="badge bg-gray-100 text-gray-700 font-mono text-xs">{h}</span>
              ))}
            </div>
          </div>
          <button onClick={() => downloadTemplate(tab)}
            className="btn-secondary btn-sm text-xs whitespace-nowrap">
            ↓ Bajar plantilla CSV
          </button>
        </div>
        <p className="text-xs text-gray-500">{t.hint}</p>
      </div>

      {/* Upload */}
      <div className="card space-y-3">
        <label className="label">Seleccioná el archivo (.xlsx o .csv)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-ecoa-100 file:text-ecoa-700 hover:file:bg-ecoa-200 cursor-pointer"
          onChange={e => { setFile(e.target.files[0] || null); setResult(null) }}
        />
        {file && (
          <p className="text-xs text-gray-500">Archivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</p>
        )}
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="btn-primary btn-sm disabled:opacity-50">
          {loading ? 'Importando…' : 'Importar'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`card space-y-2 ${result.ok > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <p className={`font-semibold ${result.ok > 0 ? 'text-green-700' : 'text-gray-700'}`}>
            {result.ok > 0 ? `✓ ${result.ok} fila${result.ok !== 1 ? 's' : ''} importada${result.ok !== 1 ? 's' : ''} correctamente` : 'Sin filas importadas'}
          </p>
          {result.errors?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">{result.errors.length} error{result.errors.length !== 1 ? 'es' : ''}:</p>
              <ul className="text-xs text-red-600 space-y-0.5 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
