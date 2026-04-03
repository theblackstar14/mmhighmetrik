'use client'
import { useState, useRef, useEffect } from 'react'
import type { LicitacionResumen } from '@/lib/reportes'

const CARD_H = 320  // must match RentabilidadTrimestral height

const ESTADO: Record<string, { bg: string; color: string; border: string }> = {
  en_evaluacion: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  presentada:    { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  ganada:        { bg: '#ECFDF5', color: '#059669', border: '#6EE7B7' },
  perdida:       { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  desierta:      { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
}

const LABEL: Record<string, string> = {
  en_evaluacion: 'En evaluación', presentada: 'Presentada',
  ganada: 'Ganada', perdida: 'Perdida', desierta: 'Desierta',
}

const ESTADOS_ORDER = ['en_evaluacion','presentada','ganada','perdida','desierta']

interface Props { data: LicitacionResumen[] }

function LicitacionItem({ l }: { l: LicitacionResumen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #F1F5F9' }}>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A' }}>{l.nombre}</div>
        <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>
          {l.entidad} · {l.tipo}{l.fecha_presentacion ? ` · ${l.fecha_presentacion}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', flexShrink: 0, marginLeft: 12 }}>
        {l.monto_referencial ? `S/ ${l.monto_referencial.toLocaleString()}` : '—'}
      </div>
    </div>
  )
}

export default function PipelineLicitaciones({ data }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [modal, setModal]         = useState(false)

  const porEstado = ESTADOS_ORDER.map(e => ({
    estado: e, label: LABEL[e] ?? e,
    items: data.filter(l => l.estado === e),
    total: data.filter(l => l.estado === e).reduce((s, l) => s + (l.monto_referencial ?? 0), 0),
  })).filter(g => g.items.length > 0)

  const totalReferencial = data.reduce((s, l) => s + (l.monto_referencial ?? 0), 0)
  const tasaExito = (() => {
    const fin = data.filter(l => ['ganada','perdida'].includes(l.estado)).length
    return fin ? Math.round(data.filter(l => l.estado === 'ganada').length / fin * 100) : 0
  })()

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const id = setTimeout(() => setOverflows(el.scrollHeight > el.clientHeight + 2), 80)
    return () => clearTimeout(id)
  }, [data])

  return (
    <>
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)',
        height: CARD_H, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Pipeline de licitaciones</div>
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{data.length} licitaciones · S/ {totalReferencial.toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>Tasa éxito</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{tasaExito}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>En cartera</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>
                S/ {data.filter(l => ['en_evaluacion','presentada'].includes(l.estado)).reduce((s, l) => s + (l.monto_referencial ?? 0), 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* List — clipped to remaining height */}
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 11 }}>Sin licitaciones registradas.</div>
        ) : (
          <div ref={listRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            {porEstado.map(grupo => {
              const st = ESTADO[grupo.estado]
              return (
                <div key={grupo.estado}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, padding: '2px 9px', borderRadius: 5 }}>
                      {grupo.label} ({grupo.items.length})
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>S/ {grupo.total.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {grupo.items.map(l => <LicitacionItem key={l.id} l={l} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Expandir — solo si hay overflow */}
        {overflows && (
          <button
            onClick={() => setModal(true)}
            style={{
              marginTop: 10, flexShrink: 0, width: '100%', padding: '7px 0',
              borderRadius: 7, border: '1px solid #BFDBFE',
              background: '#EFF6FF', color: '#2563EB',
              fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DBEAFE' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF' }}
          >
            ⤢ Expandir · ver todas ({data.length})
          </button>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Pipeline de licitaciones</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {data.length} licitaciones · S/ {totalReferencial.toLocaleString()} · tasa éxito {tasaExito}%
                </div>
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', padding: 4 }}>×</button>
            </div>

            {/* KPI strip */}
            <div style={{ padding: '10px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
              {ESTADOS_ORDER.map(e => {
                const g = porEstado.find(p => p.estado === e)
                if (!g) return null
                const st = ESTADO[e]
                return (
                  <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, padding: '2px 7px', borderRadius: 4 }}>
                      {LABEL[e]}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{g.items.length}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>· S/ {g.total.toLocaleString()}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {porEstado.map(grupo => {
                const st = ESTADO[grupo.estado]
                return (
                  <div key={grupo.estado}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, padding: '2px 9px', borderRadius: 5 }}>
                        {grupo.label} ({grupo.items.length})
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>S/ {grupo.total.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {grupo.items.map(l => <LicitacionItem key={l.id} l={l} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
