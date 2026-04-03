import type { ProyectoRanking, ExposicionItem } from '@/lib/reportes'

interface Props {
  ranking: ProyectoRanking[]
  exposicion: ExposicionItem[]
}

const META_MARGEN = 22

export default function RankingYExposicion({ ranking, exposicion }: Props) {
  const top3    = ranking.slice(0, 3)
  const bottom3 = ranking.slice(-3).reverse()
  const totalAR = exposicion.reduce((s, e) => s + e.monto, 0)
  const maxAR   = Math.max(...exposicion.map(e => e.monto), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

      {/* Ranking */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Ranking de obras</div>
        <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 16 }}>Mejor y peor margen vs. meta {META_MARGEN}%</div>

        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Top 3</div>
        {top3.map((p, i) => {
          const mc = p.margen >= META_MARGEN ? '#059669' : p.margen >= 15 ? '#D97706' : '#DC2626'
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: mc, width: `${Math.min(100, p.margen)}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: mc, flexShrink: 0 }}>{p.margen}%</div>
            </div>
          )
        })}

        <div style={{ height: 1, background: '#F1F5F9', margin: '12px 0 10px' }} />
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Bajo rendimiento</div>
        {bottom3.map((p, i) => {
          const mc = '#DC2626'
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#DC2626', flexShrink: 0 }}>
                ↓
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: mc, width: `${Math.min(100, p.margen)}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: mc, flexShrink: 0 }}>{p.margen}%</div>
            </div>
          )
        })}
      </div>

      {/* Exposición financiera */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Exposición financiera</div>
        <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 6 }}>Antigüedad de cuentas por cobrar</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
          S/ {totalAR.toLocaleString()}
          <span style={{ fontSize: 11, fontWeight: 400, color: '#64748B', marginLeft: 8 }}>total pendiente</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {exposicion.map(e => (
            <div key={e.bucket}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A' }}>{e.bucket}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#64748B' }}>{e.cantidad} factura{e.cantidad !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: e.color }}>
                    S/ {e.monto.toLocaleString()}
                  </span>
                </div>
              </div>
              <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: e.color,
                  width: `${totalAR > 0 ? Math.round((e.monto / totalAR) * 100) : 0}%`,
                  transition: 'width .4s ease',
                }} />
              </div>
              {e.monto > 0 && (
                <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 3, textAlign: 'right' }}>
                  {totalAR > 0 ? Math.round((e.monto / totalAR) * 100) : 0}% del total
                </div>
              )}
            </div>
          ))}
        </div>

        {totalAR === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#059669', fontSize: 11, fontWeight: 500 }}>
            ✓ Sin cuentas por cobrar pendientes
          </div>
        )}
      </div>
    </div>
  )
}
