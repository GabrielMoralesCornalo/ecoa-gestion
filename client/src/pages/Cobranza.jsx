import React, { useEffect, useState, useRef } from 'react'
import api from '../api'

const ALERT_COLORS = {
  '1er_aviso': 'alert-1er',
  '2do_aviso': 'alert-2do',
  'formal':    'alert-formal',
  'critico':   'alert-critico',
}
const ALERT_LABELS = {
  '1er_aviso': '1er aviso',
  '2do_aviso': '2do aviso',
  'formal':    'Aviso formal',
  'critico':   'Crítico',
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Cobranza() {
  const [cohorts, setCohorts] = useState([])
  const [cohortId, setCohortId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [panel, setPanel] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmData, setConfirmData] = useState({})
  const [msg, setMsg] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ student_id: '', paid_date: '', amount_paid: '', method: 'transferencia', notes: '' })
  const fileRef = useRef()

  useEffect(() => {
    api.get('/cohorts').then(r => {
      setCohorts(r.data)
      const a = r.data.find(c => c.active)
      if (a) setCohortId(String(a.id))
    })
  }, [])

  useEffect(() => {
    if (cohortId && month) loadPanel()
  }, [cohortId, month])

  async function loadPanel() {
    setLoading(true)
    try {
      const { data } = await api.get(`/cobranza/panel?cohort_id=${cohortId}&month=${month}`)
      setPanel(data)
    } finally {
      setLoading(false)
    }
  }

  // Alertas activas
  const alertas = panel.filter(p => p.alert_level)

  // IA scan
  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setScanLoading(true)
    setScanError('')
    setScanResult(null)
    const fd = new FormData()
    fd.append('receipt', file)
    try {
      const { data } = await api.post('/cobranza/scan-receipt', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setScanResult(data)
      setConfirmData({
        student_id: data.matches[0]?.id || '',
        month,
        paid_date: data.extracted.date || '',
        amount_paid: data.extracted.amount || '',
        method: data.extracted.source || 'transferencia',
        receipt_path: data.receipt_path,
        notes: '',
      })
    } catch (err) {
      setScanError(err.response?.data?.error || 'Error al procesar el comprobante')
    } finally {
      setScanLoading(false)
    }
  }

  async function confirmPayment() {
    setConfirming(true)
    try {
      await api.post('/cobranza/payments/from-receipt', confirmData)
      setScanResult(null)
      setMsg('✓ Pago registrado')
      loadPanel()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error')
    } finally {
      setConfirming(false)
    }
  }

  async function saveManual(e) {
    e.preventDefault()
    try {
      await api.post('/cobranza/payments', { ...manualForm, month })
      setShowManual(false)
      setManualForm({ student_id: '', paid_date: '', amount_paid: '', method: 'transferencia', notes: '' })
      setMsg('✓ Pago registrado')
      loadPanel()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error')
    }
  }

  async function sendReminder(student_id, alert_level) {
    await api.post('/cobranza/reminders', { student_id, month, alert_level })
    setMsg('✓ Recordatorio registrado')
    loadPanel()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Cobranza</h1>

      <div className="flex flex-wrap gap-2">
        <select className="input w-44" value={cohortId} onChange={e => setCohortId(e.target.value)}>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" className="input w-40" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="btn-primary btn-sm" onClick={() => setShowManual(s => !s)}>+ Pago manual</button>
        <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={scanLoading}>
          {scanLoading ? 'Procesando…' : '📷 Cargar comprobante (IA)'}
        </button>
        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      </div>

      {msg && <p className="text-green-600 text-sm font-medium">{msg}</p>}
      {scanError && <p className="text-red-600 text-sm">{scanError}</p>}

      {/* Resultado IA */}
      {scanResult && (
        <div className="card border-ecoa-200 bg-ecoa-50 space-y-3">
          <h3 className="font-semibold text-ecoa-800">Comprobante detectado</h3>
          <div className="text-sm space-y-1">
            <p><strong>Pagador detectado:</strong> {scanResult.extracted.payer_name || '—'}</p>
            <p><strong>Monto:</strong> ${scanResult.extracted.amount?.toLocaleString('es-AR') || '—'}</p>
            <p><strong>Fecha:</strong> {scanResult.extracted.date || '—'}</p>
            <p><strong>Origen:</strong> {scanResult.extracted.source || '—'}</p>
          </div>
          <div>
            <label className="label">¿A qué alumno corresponde?</label>
            <select className="input" value={confirmData.student_id}
              onChange={e => setConfirmData(d => ({ ...d, student_id: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {scanResult.matches.map(m => (
                <option key={m.id} value={m.id}>{m.name} (score: {m.score})</option>
              ))}
              {panel.map(p => (
                <option key={p.student_id} value={p.student_id}>{p.student_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Fecha pago</label>
              <input type="date" className="input" value={confirmData.paid_date}
                onChange={e => setConfirmData(d => ({ ...d, paid_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Monto pagado</label>
              <input type="number" className="input" value={confirmData.amount_paid}
                onChange={e => setConfirmData(d => ({ ...d, amount_paid: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={confirmPayment} disabled={confirming || !confirmData.student_id}>
              {confirming ? 'Guardando…' : 'Confirmar pago'}
            </button>
            <button className="btn-secondary" onClick={() => setScanResult(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Pago manual */}
      {showManual && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-700">Pago manual</h3>
          <form onSubmit={saveManual} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="label">Alumno *</label>
                <select className="input" value={manualForm.student_id}
                  onChange={e => setManualForm(f => ({ ...f, student_id: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {panel.map(p => <option key={p.student_id} value={p.student_id}>{p.student_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fecha pago</label>
                <input type="date" className="input" value={manualForm.paid_date}
                  onChange={e => setManualForm(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Monto</label>
                <input type="number" className="input" value={manualForm.amount_paid}
                  onChange={e => setManualForm(f => ({ ...f, amount_paid: e.target.value }))} />
              </div>
              <div>
                <label className="label">Método</label>
                <select className="input" value={manualForm.method}
                  onChange={e => setManualForm(f => ({ ...f, method: e.target.value }))}>
                  <option>transferencia</option>
                  <option>efectivo</option>
                  <option>mercado pago</option>
                  <option>otro</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <input className="input" value={manualForm.notes}
                  onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm">Guardar</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowManual(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Alertas activas */}
      {alertas.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-2">⚠️ Alumnos en mora ({alertas.length})</h2>
          <div className="space-y-2">
            {alertas.map(a => (
              <div key={a.student_id} className={`p-3 rounded-lg ${ALERT_COLORS[a.alert_level]} flex items-center justify-between`}>
                <div>
                  <span className="font-medium text-sm">{a.student_name}</span>
                  <span className="ml-2 text-xs opacity-75">{a.days_late} días de atraso</span>
                  <span className={`ml-2 badge text-xs ${
                    a.alert_level === '1er_aviso' ? 'bg-yellow-200 text-yellow-900' :
                    a.alert_level === '2do_aviso' ? 'bg-orange-200 text-orange-900' :
                    'bg-red-200 text-red-900'
                  }`}>{ALERT_LABELS[a.alert_level]}</span>
                  {a.reminders.length > 0 && (
                    <span className="ml-2 text-xs opacity-60">{a.reminders.length} recordatorio(s) enviado(s)</span>
                  )}
                </div>
                <button onClick={() => sendReminder(a.student_id, a.alert_level)}
                  className="btn btn-sm btn-secondary text-xs">Registrar recordatorio</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel mensual */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b font-medium text-gray-700">
          Estado de pagos — {month}
        </div>
        {loading
          ? <p className="px-4 py-8 text-center text-gray-400">Cargando…</p>
          : panel.length === 0
            ? <p className="px-4 py-8 text-center text-gray-400 text-sm">Sin datos</p>
            : <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead className="border-b bg-gray-50">
                    <tr className="text-gray-500 text-left">
                      <th className="px-4 py-2">Alumno</th>
                      <th className="px-4 py-2 text-center">Estado</th>
                      <th className="px-4 py-2 hidden sm:table-cell">Monto</th>
                      <th className="px-4 py-2 hidden sm:table-cell">Condición</th>
                      <th className="px-4 py-2 hidden md:table-cell">Fecha pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {panel.map(p => (
                      <tr key={p.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{p.student_name}</td>
                        <td className="px-4 py-2 text-center">
                          {p.paid
                            ? <span className="semaforo-verde">✓ Pagó</span>
                            : p.alert_level
                              ? <span className="semaforo-rojo">En mora</span>
                              : <span className="semaforo-gris">Pendiente</span>
                          }
                        </td>
                        <td className="px-4 py-2 hidden sm:table-cell text-gray-600">
                          {p.payment ? `$${p.payment.amount_paid?.toLocaleString('es-AR')}` :
                           p.fee ? `$${p.fee.amount?.toLocaleString('es-AR')}` : '—'}
                        </td>
                        <td className="px-4 py-2 hidden sm:table-cell">
                          {p.fee?.condition && p.fee.condition !== 'normal'
                            ? <span className="badge bg-purple-100 text-purple-800 capitalize">{p.fee.condition}</span>
                            : <span className="text-gray-400 text-xs">normal</span>
                          }
                        </td>
                        <td className="px-4 py-2 hidden md:table-cell text-gray-500">
                          {p.payment?.paid_date?.slice(0,10) || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
    </div>
  )
}
