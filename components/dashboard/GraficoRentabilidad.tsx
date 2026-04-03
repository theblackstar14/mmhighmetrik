'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import type { ProyectoResumen } from '@/lib/types/database'
Chart.register(...registerables)

interface Props { data: ProyectoResumen[] }

export default function GraficoRentabilidad({ data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [drill, setDrill] = useState<ProyectoResumen | null>(null)

  const color  = (m: number) => m < 15 ? '#b91c1c' : m < 22 ? '#92400e' : '#15803d'
  const colorL = (m: number) => m < 15 ? 'rgba(185,28,28,.13)' : m < 22 ? 'rgba(146,64,14,.13)' : 'rgba(21,128,61,.13)'

  useEffect(() => {
    if (!ref.current || !data.length) return
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.nombre.length > 14 ? d.nombre.slice(0, 14) + '…' : d.nombre),
        datasets: [
          { label: 'Margen real', data: data.map(d => d.margen), backgroundColor: data.map(d => colorL(d.margen)), borderColor: data.map(d => color(d.margen)), borderWidth: 1.5, borderRadius: 5, borderSkipped: false },
          { label: 'Meta 22%', data: data.map(() => 22), type: 'line', borderColor: 'rgba(55,65,81,.4)', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2640', padding: 10, cornerRadius: 7, callbacks: { label: c => c.datasetIndex === 1 ? ' Meta: 22%' : ` Margen: ${c.raw}%` } } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 10.5 } } }, y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: v => v + '%' }, min: 0, max: 40 } },
        onClick: (_, els) => { if (els.length && els[0].datasetIndex === 0) setDrill(data[els[0].index]) },
      },
    })
    return () => chart.destroy()
  }, [data])

  const stCls = (st: string) => st === 'activo' ? { bg: '#f0fdf4', color: '#15803d' } : st === 'pausado' ? { bg: '#fffbeb', color: '#92400e' } : { bg: '#fef2f2', color: '#b91c1c' }

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #e1e5ed', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Rentabilidad por obra</div>
          <div style={{ fontSize: 10.5, color: '#8c96ae', marginTop: 2 }}>Margen real vs. meta 22% — clic en barra para detalle</div>
        </div>
        <canvas ref={ref} />
      </div>

      {drill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,35,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDrill(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '86vw', maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{drill.nombre}</div>
                <div style={{ fontSize: 10.5, color: '#8c96ae', marginTop: 2 }}>Detalle financiero</div>
              </div>
              <button onClick={() => setDrill(null)} style={{ background: 'none', border: '1px solid #e1e5ed', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Valor contrato', val: `S/ ${drill.presupuesto_contrato.toLocaleString()}`, color: '#1b2235' },
                { label: 'Margen real', val: `${drill.margen}%`, color: color(drill.margen) },
                { label: 'Avance físico', val: `${drill.avance_fisico}%`, color: '#1b2235' },
                { label: 'Estado', val: drill.estado, color: stCls(drill.estado).color },
              ].map(k => (
                <div key={k.label} style={{ background: '#f7f8fa', border: '1px solid #e1e5ed', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 9.5, color: '#8c96ae', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#f7f8fa', borderRadius: 8, padding: '10px 14px', border: '1px solid #e1e5ed' }}>
              <div style={{ fontSize: 10.5, color: '#4a5470' }}>
                Desviación vs. meta: <strong style={{ color: drill.margen >= 22 ? '#15803d' : '#b91c1c' }}>
                  {drill.margen >= 22 ? '+' : ''}{(drill.margen - 22).toFixed(1)}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}