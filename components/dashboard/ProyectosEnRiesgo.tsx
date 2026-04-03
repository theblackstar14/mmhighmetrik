import type { ProyectoRiesgo } from '@/lib/types/database'

interface Props { data: ProyectoRiesgo[] }

function nivelRiesgo(desviacion: number, diasRestantes: number) {
  if (desviacion < -20 || diasRestantes < 0)
    return { label: 'Crítico', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
  if (desviacion < -10 || diasRestantes < 15)
    return { label: 'Alto', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' }
  return { label: 'Medio', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' }
}

export default function ProyectosEnRiesgo({ data }: Props) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Proyectos en riesgo</div>
        <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
          Obras con avance físico por debajo del cronograma (±10%)
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#059669', fontSize: 11, fontWeight: 500 }}>
          ✓ Todos los proyectos van dentro del cronograma
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(p => {
            const nivel = nivelRiesgo(p.desviacion, p.dias_restantes)
            const pct = Math.max(0, Math.min(100, p.avance_fisico))
            const pctEsp = Math.max(0, Math.min(100, p.avance_esperado))
            return (
              <div key={p.id} style={{
                padding: '14px 16px', borderRadius: 10,
                background: nivel.bg, border: `1px solid ${nivel.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{p.nombre}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      {p.cliente} · Vence {p.fecha_fin_contrato}
                      {p.dias_restantes < 0
                        ? <span style={{ color: '#DC2626', fontWeight: 600 }}> · VENCIDO</span>
                        : ` · ${p.dias_restantes}d restantes`
                      }
                    </div>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: '#fff', color: nivel.color, padding: '2px 9px', borderRadius: 5, border: `1px solid ${nivel.border}`, flexShrink: 0 }}>
                    {nivel.label}
                  </span>
                </div>

                {/* Barras superpuestas */}
                <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.6)', overflow: 'hidden', marginBottom: 6 }}>
                  {/* Avance esperado (fondo) */}
                  <div style={{ position: 'absolute', height: '100%', borderRadius: 4, background: 'rgba(148,163,184,.35)', width: `${pctEsp}%` }} />
                  {/* Avance real */}
                  <div style={{ position: 'absolute', height: '100%', borderRadius: 4, background: nivel.color, width: `${pct}%` }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: nivel.color }}>
                  <span>Real: <strong>{pct}%</strong></span>
                  <span style={{ color: '#64748B' }}>
                    Desviación: <strong style={{ color: nivel.color }}>{p.desviacion > 0 ? '+' : ''}{p.desviacion}pp</strong>
                  </span>
                  <span style={{ color: '#94A3B8' }}>Esperado: {pctEsp}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
