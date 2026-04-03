'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

interface Mes { mes: string; ingresos: number; egresos: number }
interface Props { data: Mes[] }

export default function GraficoIE({ data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<Chart | null>(null)
  const [modo, setModo] = useState<'ambos' | 'ingresos' | 'egresos'>('ambos')

  useEffect(() => {
    if (!ref.current) return
    inst.current?.destroy()
    inst.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map(d => d.mes),
        datasets: [
          { label: 'Ingresos', data: data.map(d => d.ingresos), backgroundColor: 'rgba(29,78,216,.13)', borderColor: '#1d4ed8', borderWidth: 1.5, borderRadius: 5, borderSkipped: false, hidden: modo === 'egresos' },
          { label: 'Egresos',  data: data.map(d => d.egresos),  backgroundColor: 'rgba(185,28,28,.13)', borderColor: '#b91c1c', borderWidth: 1.5, borderRadius: 5, borderSkipped: false, hidden: modo === 'ingresos' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e2640', padding: 10, cornerRadius: 7, callbacks: { label: c => ` S/ ${c.raw?.toLocaleString()}` } } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: v => 'S/'+Number(v).toLocaleString() } } },
      },
    })
    return () => { inst.current?.destroy() }
  }, [data, modo])

  const btnStyle = (active: boolean) => ({
    fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${active ? '#1d4ed8' : '#c8cdd9'}`,
    color: active ? '#1d4ed8' : '#8c96ae',
    background: active ? 'rgba(29,78,216,.08)' : 'none',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5ed', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Ingresos vs. Egresos</div>
          <div style={{ fontSize: 10.5, color: '#8c96ae', marginTop: 2 }}>Comparativo mensual del año</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['ambos','ingresos','egresos'] as const).map(m => (
            <button key={m} style={btnStyle(modo === m)} onClick={() => setModo(m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={ref} />
    </div>
  )
}