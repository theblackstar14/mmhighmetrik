'use client'
import { useState } from 'react'
import type { ProyectoTimeline } from '@/lib/reportes'

const RIESGO = {
  ok:      { color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', label: 'En cronograma' },
  medio:   { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', label: 'Atención'       },
  alto:    { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', label: 'En riesgo'      },
  critico: { color: '#7F1D1D', bg: '#FEF2F2', border: '#DC2626', label: 'Crítico'        },
}

interface Props { data: ProyectoTimeline[] }

export default function RutaCritica({ data }: Props) {
  const [drill, setDrill] = useState<ProyectoTimeline | null>(null)

  if (!data.length) return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Ruta crítica de obras</div>
      <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>
        Sin proyectos activos con fechas de contrato registradas
      </div>
    </div>
  )

  // Rango del timeline: min fecha inicio → max fecha fin
  const fechas = data.flatMap(p => [new Date(p.fecha_inicio), new Date(p.fecha_fin)])
  const tIni   = Math.min(...fechas.map(d => d.getTime()))
  const tFin   = Math.max(...fechas.map(d => d.getTime()))
  const rango  = Math.max(1, tFin - tIni)
  const hoy    = Date.now()

  const posX = (d: string) => Math.max(0, Math.min(100, ((new Date(d).getTime() - tIni) / rango) * 100))
  const fmtDate = (s: string) => {
    const d = new Date(s)
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }

  const hoyPct = Math.max(0, Math.min(100, ((hoy - tIni) / rango) * 100))

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 22, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Ruta crítica de obras</div>
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
              Timeline contractual · avance real vs esperado · clic para detalle
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {Object.entries(RIESGO).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
                <span style={{ fontSize: 9.5, color: '#64748B' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Eje de fechas */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94A3B8', paddingLeft: 160 }}>
            {[0, 25, 50, 75, 100].map(p => (
              <span key={p}>{fmtDate(new Date(tIni + rango * p / 100).toISOString().split('T')[0])}</span>
            ))}
          </div>
        </div>

        {/* Barras */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(p => {
            const r    = RIESGO[p.riesgo]
            const xIni = posX(p.fecha_inicio)
            const xFin = posX(p.fecha_fin)
            const ancho = Math.max(1, xFin - xIni)
            const progReal = (p.avance_fisico / 100) * ancho
            const progEsp  = (p.avance_esperado / 100) * ancho
            const xFinEst  = posX(p.fecha_fin_estimada)

            return (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setDrill(p)}
              >
                {/* Nombre */}
                <div style={{ width: 150, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nombre}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748B' }}>{p.cliente}</div>
                </div>

                {/* Timeline */}
                <div style={{ flex: 1, position: 'relative', height: 36 }}>
                  {/* Fondo grid */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {[0,25,50,75].map(p => (
                      <div key={p} style={{ width: '25%', borderRight: '1px solid #F1F5F9' }} />
                    ))}
                  </div>

                  {/* Barra fondo (duración contractual) */}
                  <div style={{
                    position: 'absolute', top: 8, height: 20,
                    left: `${xIni}%`, width: `${ancho}%`,
                    background: '#F1F5F9', borderRadius: 4,
                  }} />

                  {/* Avance esperado (gris) */}
                  <div style={{
                    position: 'absolute', top: 8, height: 20,
                    left: `${xIni}%`, width: `${progEsp}%`,
                    background: 'rgba(148,163,184,.4)', borderRadius: '4px 0 0 4px',
                  }} />

                  {/* Avance real (color riesgo) */}
                  <div style={{
                    position: 'absolute', top: 10, height: 16,
                    left: `${xIni}%`, width: `${progReal}%`,
                    background: r.color, borderRadius: '4px 0 0 4px', opacity: .85,
                  }} />

                  {/* Fecha fin estimada (si difiere) */}
                  {Math.abs(xFinEst - xFin) > 1 && (
                    <div style={{
                      position: 'absolute', top: 6, bottom: 6,
                      left: `${xFinEst}%`, width: 1.5,
                      background: r.color, opacity: .6,
                    }} />
                  )}

                  {/* Hoy */}
                  <div style={{
                    position: 'absolute', top: 4, bottom: 4,
                    left: `${hoyPct}%`, width: 1.5,
                    background: '#374151',
                  }} />

                  {/* Etiqueta avance */}
                  <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    display: 'flex', alignItems: 'center',
                    fontSize: 10, fontWeight: 700, color: r.color,
                    paddingRight: 4,
                  }}>
                    {p.avance_fisico}%
                  </div>
                </div>

                {/* Badge riesgo */}
                <span style={{
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                  background: r.bg, color: r.color, border: `1px solid ${r.border}`,
                  padding: '2px 8px', borderRadius: 5,
                }}>
                  {p.desviacion > 0 ? '+' : ''}{p.desviacion}pp
                </span>
              </div>
            )
          })}
        </div>

        {/* Hoy marker legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, paddingLeft: 160 }}>
          <div style={{ width: 16, height: 1.5, background: '#374151' }} />
          <span style={{ fontSize: 9.5, color: '#64748B' }}>Hoy · La barra gris = avance esperado · La barra de color = avance real</span>
        </div>
      </div>

      {/* Modal detalle */}
      {drill && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDrill(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const r = RIESGO[drill.riesgo]
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{drill.nombre}</div>
                      <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{drill.cliente} · {drill.codigo}</div>
                    </div>
                    <button onClick={() => setDrill(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                    {[
                      { label: 'Avance real',    val: `${drill.avance_fisico}%`,    color: r.color },
                      { label: 'Avance esperado',val: `${drill.avance_esperado}%`,  color: '#64748B' },
                      { label: 'Desviación',      val: `${drill.desviacion > 0 ? '+' : ''}${drill.desviacion}pp`, color: r.color },
                      { label: 'Días restantes', val: drill.dias_restantes < 0 ? 'VENCIDO' : `${drill.dias_restantes}d`, color: drill.dias_restantes < 0 ? '#DC2626' : '#0F172A' },
                      { label: 'Velocidad',       val: `${drill.velocidad_diaria}%/día`, color: '#64748B' },
                      { label: 'Fin estimado',    val: drill.fecha_fin_estimada,    color: drill.fecha_fin_estimada > drill.fecha_fin ? '#DC2626' : '#059669' },
                    ].map(k => (
                      <div key={k.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '11px 14px' }}>
                        <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 5 }}>{k.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{k.val}</div>
                      </div>
                    ))}
                  </div>

                  {drill.fecha_fin_estimada > drill.fecha_fin && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 11, color: '#B91C1C' }}>
                      ⚠ Al ritmo actual, la obra terminaría el <strong>{drill.fecha_fin_estimada}</strong>, con{' '}
                      <strong>{Math.ceil((new Date(drill.fecha_fin_estimada).getTime() - new Date(drill.fecha_fin).getTime()) / 86400000)} días de retraso</strong> sobre el contrato.
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
}
