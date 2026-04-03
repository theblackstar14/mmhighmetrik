'use client'
import { useState } from 'react'

const DEMOS: Record<string, string> = {
  '¿Cuál es la obra más rentable?': 'El Hospital Villa El Salvador lidera con el mayor margen. Con contrato de S/ 7.1M y avance del 92%, es la mayor contribuidora a la utilidad neta del mes.',
  '¿Cómo está el flujo de caja?': 'El flujo proyectado a 30 días es positivo. Revise las certificaciones pendientes de cobro y los pagos a proveedores próximos a vencer para mantener liquidez.',
  '¿Qué facturas están por vencer?': 'Hay facturas vencidas por cobrar. Se recomienda hacer seguimiento inmediato a EsSalud y MTC para no afectar el flujo de caja.',
  '¿Cuánto debemos a proveedores?': 'Revise el módulo de cuentas por pagar para el total actualizado. Priorice los pagos con penalidades contractuales primero.',
  '¿Qué obra tiene mayor desviación?': 'Colegio Ate N°32 presenta la mayor desviación presupuestal. Se recomienda una revisión urgente de costos en esa obra.',
}

export default function AsistenteIA() {
  const [msgs, setMsgs] = useState<{role:string;text:string}[]>([
    { role: 'ai', text: 'Hola, soy el asistente financiero. Puedo responder consultas sobre obras, ingresos, egresos y alertas.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    const q = input.trim()
    if (!q) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    const resp = DEMOS[q] || 'En producción esta consulta accede a los datos reales de la empresa en tiempo real.'
    setMsgs(m => [...m, { role: 'ai', text: resp }])
    setLoading(false)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5ed', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid #e1e5ed', background: '#f7f8fa', display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 9px', borderRadius: 3, fontSize: 10, fontWeight: 700, border: '1px solid rgba(29,78,216,.15)' }}>
          ● IA · Demo
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Asistente financiero</div>
          <div style={{ fontSize: 10.5, color: '#8c96ae' }}>Consultas sobre obras, ingresos y alertas</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 18px 0' }}>
        {Object.keys(DEMOS).map(q => (
          <button key={q} onClick={() => { setInput(q); }} style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 4, border: '1px solid #c8cdd9', color: '#4a5470', cursor: 'pointer', background: 'none' }}>
            {q}
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 18px', maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: m.role === 'ai' ? '#eff6ff' : '#e5e7eb', color: m.role === 'ai' ? '#1d4ed8' : '#374151' }}>
              {m.role === 'ai' ? 'IA' : 'JR'}
            </div>
            <div style={{ maxWidth: '80%', padding: '8px 12px', fontSize: 12, lineHeight: 1.5, borderRadius: m.role === 'ai' ? '3px 9px 9px 9px' : '9px 3px 9px 9px', background: m.role === 'ai' ? '#f7f8fa' : 'rgba(29,78,216,.1)', border: `1px solid ${m.role === 'ai' ? '#e1e5ed' : 'rgba(29,78,216,.2)'}` }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 7 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#1d4ed8' }}>IA</div>
            <div style={{ padding: '8px 12px', background: '#f7f8fa', borderRadius: '3px 9px 9px 9px', border: '1px solid #e1e5ed', fontSize: 12, color: '#8c96ae' }}>Analizando...</div>
          </div>
        )}
      </div>
      <div style={{ padding: '11px 18px', borderTop: '1px solid #e1e5ed', display: 'flex', gap: 7 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Escriba su consulta..." style={{ flex: 1, background: '#f7f8fa', border: '1px solid #c8cdd9', borderRadius: 6, padding: '7px 12px', fontSize: 12.5, color: '#1b2235', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} style={{ padding: '7px 14px', background: '#1d4ed8', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Consultar
        </button>
      </div>
    </div>
  )
}