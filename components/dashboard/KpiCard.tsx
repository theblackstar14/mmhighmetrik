'use client'
import { useState } from 'react'
import type { KpiDetalleItem } from '@/lib/types/database'

interface Props {
  label: string
  valor: number
  variacion: number
  color: 'blue' | 'red' | 'green' | 'amber' | 'indigo'
  detalles?: KpiDetalleItem[]
  detalleLabel?: string
}

const COLORES = {
  blue:   { bar: '#2563EB', val: '#2563EB', bg: '#EFF6FF', badge: 'rgba(37,99,235,.1)'  },
  red:    { bar: '#DC2626', val: '#DC2626', bg: '#FEF2F2', badge: 'rgba(220,38,38,.1)'  },
  green:  { bar: '#059669', val: '#059669', bg: '#ECFDF5', badge: 'rgba(5,150,105,.1)'  },
  amber:  { bar: '#D97706', val: '#D97706', bg: '#FFFBEB', badge: 'rgba(217,119,6,.1)'  },
  indigo: { bar: '#7C3AED', val: '#7C3AED', bg: '#F5F3FF', badge: 'rgba(124,58,237,.1)' },
}

const ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
  pendiente: { bg: '#FFF7ED', color: '#C2410C' },
  pagada:    { bg: '#ECFDF5', color: '#059669' },
  vencida:   { bg: '#FEF2F2', color: '#DC2626' },
  cobro:     { bg: '#EFF6FF', color: '#2563EB' },
  pago:      { bg: '#FEF2F2', color: '#DC2626' },
  material:  { bg: '#F5F3FF', color: '#7C3AED' },
  subcontrato:   { bg: '#EFF6FF', color: '#0369A1' },
  mano_obra:     { bg: '#ECFDF5', color: '#059669' },
  alquiler:      { bg: '#FFFBEB', color: '#D97706' },
  administracion:{ bg: '#F8FAFC', color: '#374151' },
  impuesto:      { bg: '#FEF2F2', color: '#DC2626' },
}

export default function KpiCard({ label, valor, variacion, color, detalles, detalleLabel }: Props) {
  const [open, setOpen] = useState(false)
  const c = COLORES[color]
  const sube = variacion >= 0

  return (
    <>
      <div
        onClick={() => detalles && detalles.length > 0 && setOpen(true)}
        style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '16px 18px', boxShadow: '0 1px 4px rgba(15,23,42,.07)',
          position: 'relative', overflow: 'hidden',
          cursor: detalles && detalles.length > 0 ? 'pointer' : 'default',
          transition: 'box-shadow .15s, transform .15s',
        }}
        onMouseEnter={e => { if (detalles?.length) { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(15,23,42,.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' } }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(15,23,42,.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.bar, borderRadius: '12px 12px 0 0' }} />
        <div style={{ fontSize: 9.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.9px', marginBottom: 8, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: c.val, letterSpacing: '-.5px' }}>
          S/ {valor.toLocaleString('es-PE')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: sube ? '#ECFDF5' : '#FEF2F2', color: sube ? '#059669' : '#DC2626', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
              {sube ? '↑' : '↓'} {Math.abs(variacion)}%
            </span>
            <span style={{ fontSize: 9.5, color: '#94A3B8' }}>vs. anterior</span>
          </div>
          {detalles && detalles.length > 0 && (
            <span style={{ fontSize: 9, color: c.val, opacity: .6 }}>Ver detalle ›</span>
          )}
        </div>
      </div>

      {open && detalles && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{detalleLabel ?? label}</div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{detalles.length} transacciones · S/ {valor.toLocaleString()}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Descripción / Proyecto', 'Estado', 'Monto'].map(h => (
                      <th key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.7px', color: '#94A3B8', padding: '9px 14px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d, i) => {
                    const est = d.estado ? (ESTADO_COLORS[d.estado] ?? { bg: '#F8FAFC', color: '#64748B' }) : null
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{d.label}</div>
                          {d.sub && <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{d.sub}{d.fecha ? ` · ${d.fecha}` : ''}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
                          {est && (
                            <span style={{ background: est.bg, color: est.color, fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
                              {d.estado}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', fontSize: 12, fontWeight: 700, color: c.val, whiteSpace: 'nowrap' }}>
                          S/ {d.monto.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
