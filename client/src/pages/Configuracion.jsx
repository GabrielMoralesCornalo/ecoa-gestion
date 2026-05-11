import React, { useEffect, useState } from 'react'
import api from '../api'

const EMPTY_RECIPIENT = { name: '', phone: '', apikey: '' }

export default function Configuracion() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [testing, setTesting] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await api.get('/settings')
    setSettings(data)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      await api.put('/settings', settings)
      setMsg('✓ Configuración guardada')
    } catch (err) {
      setMsg('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function testWhatsApp(idx) {
    const r = settings.whatsapp_recipients[idx]
    if (!r.phone || !r.apikey) return setMsg('Completá teléfono y API key antes de probar')
    setTesting(idx)
    setMsg('')
    try {
      await api.post('/settings/test-whatsapp', { phone: r.phone, apikey: r.apikey })
      setMsg(`✓ Mensaje de prueba enviado a ${r.name || r.phone}`)
    } catch {
      setMsg('Error al enviar prueba')
    } finally {
      setTesting(null)
    }
  }

  function updateRecipient(idx, field, value) {
    setSettings(s => {
      const recs = [...s.whatsapp_recipients]
      recs[idx] = { ...recs[idx], [field]: value }
      return { ...s, whatsapp_recipients: recs }
    })
  }

  function addRecipient() {
    setSettings(s => ({ ...s, whatsapp_recipients: [...s.whatsapp_recipients, { ...EMPTY_RECIPIENT }] }))
  }

  function removeRecipient(idx) {
    setSettings(s => ({ ...s, whatsapp_recipients: s.whatsapp_recipients.filter((_, i) => i !== idx) }))
  }

  if (!settings) return <p className="text-gray-400 p-4">Cargando…</p>

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>

      <form onSubmit={save} className="space-y-6">

        {/* Cobranza */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-700">Cobranza</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Día de vencimiento</label>
              <input type="number" min="1" max="28" className="input"
                value={settings.due_day}
                onChange={e => setSettings(s => ({ ...s, due_day: parseInt(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-1">Ej: 10 = vence el día 10 de cada mes</p>
            </div>
            <div>
              <label className="label">Intervalo de alertas (días)</label>
              <input type="number" min="1" max="30" className="input"
                value={settings.alert_interval_days}
                onChange={e => setSettings(s => ({ ...s, alert_interval_days: parseInt(e.target.value) }))} />
              <p className="text-xs text-gray-400 mt-1">Ej: 5 = avisar cada 5 días de atraso</p>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p className="font-medium">¿Cómo funciona?</p>
            <p>Si el vencimiento es el día 10 y el intervalo es 5 días, se manda alerta por WhatsApp el día 15, 20, 25, 30…</p>
            <p>La alerta lista todos los alumnos que todavía no pagaron ese mes.</p>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Alertas por WhatsApp</h2>
            <button type="button" onClick={addRecipient} className="btn-secondary btn-sm text-xs">
              + Agregar número
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 space-y-2">
            <p className="font-medium">Configuración de CallMeBot (gratis, 1 sola vez por número):</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Guardá este número en tus contactos: <strong>+34 644 63 73 79</strong></li>
              <li>Mandále este mensaje por WhatsApp: <strong>I allow callmebot to send me messages</strong></li>
              <li>Te van a responder con tu API Key (ej: <code className="bg-yellow-100 px-1 rounded">1234567</code>)</li>
              <li>Pegá esa API Key acá abajo junto con tu número</li>
            </ol>
          </div>

          {settings.whatsapp_recipients.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Sin destinatarios. Hacé clic en "+ Agregar número".</p>
          )}

          {settings.whatsapp_recipients.map((r, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Destinatario {idx + 1}</span>
                <button type="button" onClick={() => removeRecipient(idx)}
                  className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="input" placeholder="Ej: Gaby" value={r.name}
                  onChange={e => updateRecipient(idx, 'name', e.target.value)} />
              </div>
              <div>
                <label className="label">Teléfono (con código de país, sin +)</label>
                <input className="input" placeholder="Ej: 5493794123456" value={r.phone}
                  onChange={e => updateRecipient(idx, 'phone', e.target.value)} />
                <p className="text-xs text-gray-400 mt-0.5">Argentina: 54 + 9 + código de área + número (sin 0 ni 15)</p>
              </div>
              <div>
                <label className="label">API Key de CallMeBot</label>
                <input className="input font-mono" placeholder="Ej: 1234567" value={r.apikey}
                  onChange={e => updateRecipient(idx, 'apikey', e.target.value)} />
              </div>
              <button type="button" onClick={() => testWhatsApp(idx)}
                disabled={testing === idx}
                className="btn-secondary btn-sm text-xs w-full">
                {testing === idx ? 'Enviando prueba…' : '📱 Enviar mensaje de prueba'}
              </button>
            </div>
          ))}
        </div>

        {msg && (
          <p className={`text-sm font-medium ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>

      {/* Instrucciones cron */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">Activar envío automático diario</h2>
        <p className="text-sm text-gray-600">
          Para que la app revise y mande alertas sola todos los días, usamos <strong>cron-job.org</strong> (gratis).
        </p>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
          <li>Entrá a <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-ecoa-600 underline">cron-job.org</a> y creá una cuenta gratuita</li>
          <li>Creá un nuevo cron job con esta URL:</li>
        </ol>
        <div className="bg-gray-100 rounded p-2 font-mono text-xs break-all">
          POST https://ecoa-gestion.onrender.com/api/settings/send-alerts
        </div>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1" start={3}>
          <li>En "Headers" agregá: <code className="bg-gray-100 px-1 rounded text-xs">x-cron-secret: ecoa_cron_2026</code></li>
          <li>Configurá horario: todos los días a las 9:00 AM (Argentina = UTC-3, poner 12:00 UTC)</li>
        </ol>
        <p className="text-xs text-gray-400">El sistema solo manda el WhatsApp en los días que correspondan según tu intervalo configurado.</p>
      </div>
    </div>
  )
}
