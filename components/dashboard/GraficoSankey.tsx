'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { SankeyController, Flow } from 'chartjs-chart-sankey'
import type { SankeyFlow, EgresoDetalle } from '@/lib/types/database'

Chart.register(...registerables, SankeyController, Flow)

const NODE_COLORS: Record<string, string> = {
  'Ingresos':       '#2563EB',
  'Materiales':     '#7C3AED',
  'Subcontratos':   '#0369A1',
  'Mano de obra':   '#059669',
  'Alquileres':     '#D97706',
  'Administración': '#374151',
  'Impuestos':      '#DC2626',
  'Utilidad neta':  '#065F46',
  'Pérdida':        '#7F1D1D',
  'Egresos':        '#7F1D1D',
}
const DEFAULT_COLOR = '#64748B'

// Mapeo de etiqueta Sankey → clave raw en detallesCategorias
const LABEL_TO_CAT: Record<string, string> = {
  'Materiales':     'material',
  'Subcontratos':   'subcontrato',
  'Mano de obra':   'mano_obra',
  'Alquileres':     'alquiler',
  'Administración': 'administracion',
  'Impuestos':      'impuesto',
}

function fmtPct(value: number, total: number): string {
  if (total === 0) return '0%'
  const pct = (value / total) * 100
  if (pct < 1) return `< 1% (${pct.toFixed(1)}%)`
  return `${Math.round(pct)}%`
}

function buildChartConfig(data: SankeyFlow[], onClick?: (flow: SankeyFlow) => void) {
  return {
    type: 'sankey' as const,
    data: {
      datasets: [{
        label: 'Flujo financiero anual',
        data,
        colorFrom: (ctx: any) => NODE_COLORS[(ctx.dataset.data[ctx.dataIndex] as SankeyFlow).from] ?? DEFAULT_COLOR,
        colorTo:   (ctx: any) => NODE_COLORS[(ctx.dataset.data[ctx.dataIndex] as SankeyFlow).to]   ?? DEFAULT_COLOR,
        colorMode: 'gradient' as const,
        borderWidth: 0,
        nodeWidth: 16,
        nodePadding: 20,
        color: '#0F172A',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => {
              const d = ctx.dataset.data[ctx.dataIndex] as SankeyFlow
              const total = data.reduce((s, f) => f.from === d.from ? s + f.flow : s, 0)
              const pct = total > 0 ? (d.flow / total * 100) : 0
              const pctStr = pct < 1 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
              return ` ${d.from} → ${d.to}:  S/ ${d.flow.toLocaleString()}  (${pctStr})`
            },
          },
        },
        legend: { display: false },
      },
      onClick: (_: any, els: any[]) => {
        if (onClick && els.length) onClick(data[els[0].index])
      },
    },
  } as any
}

interface Props {
  data: SankeyFlow[]
  detalles?: Record<string, EgresoDetalle[]>
}

export default function GraficoSankey({ data, detalles = {} }: Props) {
  const ref      = useRef<HTMLCanvasElement>(null)
  const refModal = useRef<HTMLCanvasElement>(null)
  const [expanded,  setExpanded]  = useState(false)
  const [drillFlow, setDrillFlow] = useState<SankeyFlow | null>(null)

  useEffect(() => {
    if (!ref.current || !data.length) return
    const chart = new Chart(ref.current, buildChartConfig(data, setDrillFlow))
    return () => chart.destroy()
  }, [data])

  useEffect(() => {
    if (!expanded || !refModal.current || !data.length) return
    const chart = new Chart(refModal.current, buildChartConfig(data, f => { setExpanded(false); setDrillFlow(f) }))
    return () => chart.destroy()
  }, [expanded, data])

  const totalIngresos = data.reduce((s, f) => f.from === 'Ingresos' ? s + f.flow : s, 0)

  // Obtener detalles de la categoría del flujo clickeado
  const rawCat      = drillFlow ? LABEL_TO_CAT[drillFlow.to] : null
  const catDetalles = rawCat ? (detalles[rawCat] || []) : []
  const totalCat    = catDetalles.reduce((s, d) => s + d.monto, 0)
  const nodeColor   = drillFlow ? (NODE_COLORS[drillFlow.to] ?? DEFAULT_COLOR) : DEFAULT_COLOR

  return (
    <>
      {/* Card principal */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Flujo financiero anual</div>
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Distribución de ingresos por categoría · clic en flujo para detalle</div>
          </div>
          <button
            onClick={() => setExpanded(true)}
            title="Expandir"
            style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontFamily: 'inherit',
            }}
          >⤢</button>
        </div>
        {data.length === 0
          ? <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>Sin datos para mostrar</div>
          : <div style={{ height: 260 }}><canvas ref={ref} /></div>
        }
      </div>

      {/* Modal expandido */}
      {expanded && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setExpanded(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 960, boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Flujo financiero anual — Vista expandida</div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }}>Clic en un flujo para ver detalle de transacciones</div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            <div style={{ height: 480 }}><canvas ref={refModal} /></div>
          </div>
        </div>
      )}

      {/* Modal detalle de flujo */}
      {drillFlow && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,.6)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDrillFlow(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: nodeColor }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                    {drillFlow.from} → {drillFlow.to}
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B' }}>Detalle de transacciones del mes actual</div>
              </div>
              <button
                onClick={() => setDrillFlow(null)}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >✕</button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Monto anual',        val: `S/ ${drillFlow.flow.toLocaleString()}`,   color: nodeColor },
                { label: '% sobre ingresos',   val: fmtPct(drillFlow.flow, totalIngresos),      color: '#2563EB' },
                { label: 'N° transacciones',   val: catDetalles.length > 0 ? `${catDetalles.length}` : '—', color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: k.color, lineHeight: 1.3 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Transacciones del mes */}
            {catDetalles.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
                  Transacciones del mes
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Descripción', 'Proyecto', 'Monto', '%'].map(h => (
                          <th key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.7px', color: '#94A3B8', padding: '9px 12px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {catDetalles.map((d, i) => {
                        const pct = totalCat > 0 ? Math.round((d.monto / totalCat) * 100) : 0
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <td style={{ padding: '10px 12px', fontSize: 11.5, color: '#0F172A', fontWeight: 500, borderBottom: '1px solid #F1F5F9' }}>{d.descripcion}</td>
                            <td style={{ padding: '10px 12px', fontSize: 10.5, color: '#64748B', borderBottom: '1px solid #F1F5F9', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.proyecto}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: '#DC2626', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>S/ {d.monto.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2, minWidth: 40 }}>
                                  <div style={{ height: '100%', borderRadius: 2, background: nodeColor, width: `${pct}%` }} />
                                </div>
                                <span style={{ fontSize: 10, color: '#64748B', width: 30, textAlign: 'right' }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {drillFlow.to === 'Utilidad neta'
                    ? 'La utilidad es el remanente después de todos los costos'
                    : 'Sin transacciones registradas para el mes actual'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
