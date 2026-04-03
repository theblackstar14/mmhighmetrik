'use client'
import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import type { RentabilidadTrimestre } from '@/lib/reportes'
Chart.register(...registerables)

interface Props { data: RentabilidadTrimestre[]; backlog: number }

export default function RentabilidadTrimestral({ data, backlog }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  const chartData = data.filter(d => d.ingresos > 0 || d.egresos > 0)

  useEffect(() => {
    if (!ref.current) return
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.trimestre),
        datasets: [
          {
            label: 'Ingresos', type: 'bar',
            data: chartData.map(d => d.ingresos),
            backgroundColor: 'rgba(37,99,235,.15)', borderColor: '#2563EB',
            borderWidth: 1.5, borderRadius: 5, borderSkipped: false,
          },
          {
            label: 'Egresos', type: 'bar',
            data: chartData.map(d => d.egresos),
            backgroundColor: 'rgba(220,38,38,.12)', borderColor: '#DC2626',
            borderWidth: 1.5, borderRadius: 5, borderSkipped: false,
          },
          {
            label: 'Margen %', type: 'line',
            data: chartData.map(d => d.margen),
            borderColor: '#059669', borderWidth: 2,
            pointBackgroundColor: '#059669', pointRadius: 4,
            fill: false, tension: .3,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 9, padding: 14, font: { size: 10.5 }, color: '#0F172A' } },
          tooltip: { backgroundColor: '#0F172A', padding: 10, cornerRadius: 7,
            callbacks: { label: c => c.datasetIndex === 2 ? ` Margen: ${c.raw}%` : ` S/ ${Number(c.raw).toLocaleString()}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
          y:  { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: v => 'S/'+Number(v).toLocaleString(), color: '#64748B', font: { size: 10 } }, position: 'left' },
          y2: { position: 'right', grid: { display: false }, ticks: { callback: v => v+'%', color: '#059669', font: { size: 10 } }, min: 0, max: 50 },
        },
      },
    })
    return () => chart.destroy()
  }, [chartData])

  const totalIng  = data.reduce((s, d) => s + d.ingresos, 0)
  const margenProm = data.filter(d => d.ingresos > 0).reduce((s, d) => s + d.margen, 0) / (data.filter(d => d.ingresos > 0).length || 1)

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)', height: 320, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Rentabilidad trimestral</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Ingresos, egresos y margen por trimestre</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Ingresos año', val: `S/ ${totalIng.toLocaleString()}`, color: '#2563EB' },
            { label: 'Margen prom.', val: `${Math.round(margenProm)}%`,       color: '#059669' },
            { label: 'Backlog',      val: `S/ ${backlog.toLocaleString()}`,    color: '#8D919E' },
          ].map(k => (
            <div key={k.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 220 }}><canvas ref={ref} /></div>
    </div>
  )
}
