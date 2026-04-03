'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import type { EgresoCategoria, EgresoDetalle } from '@/lib/types/database'
Chart.register(...registerables)

const LABELS: Record<string, string> = {
  material: 'Materiales', subcontrato: 'Subcontratos', mano_obra: 'Mano de obra',
  alquiler: 'Alquileres', administracion: 'Administración', impuesto: 'Impuestos',
}
const COLORS   = ['#2563EB','#7C3AED','#059669','#D97706','#374151','#DC2626']
const COLORS_L = ['rgba(37,99,235,.15)','rgba(124,58,237,.15)','rgba(5,150,105,.15)','rgba(217,119,6,.15)','rgba(55,65,81,.15)','rgba(220,38,38,.15)']

interface Props {
  data: EgresoCategoria[]
  detalles?: Record<string, EgresoDetalle[]>
}

export default function GraficoEgresos({ data, detalles = {} }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [drill, setDrill] = useState<EgresoCategoria | null>(null)

  useEffect(() => {
    if (!ref.current || !data.length) return
    const chart = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: data.map(d => LABELS[d.categoria] || d.categoria),
        datasets: [{
          data: data.map(d => d.total),
          backgroundColor: COLORS_L.slice(0, data.length),
          borderColor: COLORS.slice(0, data.length),
          borderWidth: 2, hoverOffset: 12,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: '63%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 9, padding: 10, font: { size: 10.5 }, color: '#0F172A' } },
          tooltip: {
            backgroundColor: '#0F172A', padding: 11, cornerRadius: 8,
            callbacks: { label: c => ` S/ ${Number(c.raw).toLocaleString()} (${data[c.dataIndex].porcentaje}%)` },
          },
        },
        onClick: (_, els) => { if (els.length) setDrill(data[els[0].index]) },
      },
    })
    return () => chart.destroy()
  }, [data])

  const catDetalles = drill ? (detalles[drill.categoria] || []) : []
  const totalCat = catDetalles.reduce((s, d) => s + d.monto, 0)

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Egresos por categoría</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Clic en segmento para ver detalle</div>
        </div>
        <canvas ref={ref} />
      </div>

      {drill && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDrill(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{LABELS[drill.categoria]}</div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }}>Desglose de egresos del mes</div>
              </div>
              <button
                onClick={() => setDrill(null)}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total categoría', val: `S/ ${drill.total.toLocaleString()}`, color: '#0F172A' },
                { label: '% del total', val: `${drill.porcentaje}%`, color: '#2563EB' },
                { label: 'N° transacciones', val: `${catDetalles.length}`, color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Tabla de detalles */}
            {catDetalles.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
                  Transacciones
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
                      {catDetalles.map((d, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                          <td style={{ padding: '10px 12px', fontSize: 11.5, color: '#0F172A', fontWeight: 500, borderBottom: '1px solid #F1F5F9' }}>{d.descripcion}</td>
                          <td style={{ padding: '10px 12px', fontSize: 10.5, color: '#64748B', borderBottom: '1px solid #F1F5F9', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.proyecto}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: '#DC2626', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>S/ {d.monto.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2, minWidth: 40 }}>
                                <div style={{ height: '100%', borderRadius: 2, background: '#2563EB', width: `${Math.round((d.monto / (totalCat || 1)) * 100)}%` }} />
                              </div>
                              <span style={{ fontSize: 10, color: '#64748B', width: 30, textAlign: 'right' }}>
                                {Math.round((d.monto / (totalCat || 1)) * 100)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 11 }}>
                Sin detalle disponible para este mes
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
