import { getObras } from '@/lib/obras'
import TarjetaObra from '@/components/obras/TarjetaObra'

export default async function ObrasPage() {
  const { obras, kpis } = await getObras()

  return (
    <div>
      {/* Topbar */}
      <div style={{
        padding: '14px 26px', borderBottom: '1px solid #E2E8F0',
        background: '#fff', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(15,23,42,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>
            Obras
          </div>
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>Gestión y seguimiento de proyectos</div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { label: 'Activas',       val: kpis.total,                                                                color: '#0F172A' },
            { label: 'Contratado',    val: `S/ ${(kpis.monto_contratado / 1_000_000).toFixed(1)}M`,                  color: '#2563EB' },
            { label: 'En riesgo',     val: kpis.en_riesgo,                                                            color: kpis.en_riesgo > 0 ? '#DC2626' : '#059669' },
            { label: 'Atención',      val: kpis.por_vencer,                                                           color: kpis.por_vencer > 0 ? '#D97706' : '#059669' },
          ].map((k, i) => (
            <div key={k.label} style={{
              padding: '6px 16px', borderLeft: i > 0 ? '1px solid #F1F5F9' : 'none',
              textAlign: 'right',
            }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: k.color, marginTop: 1 }}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '22px 26px' }}>
        {obras.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 13 }}>
            Sin obras activas. Agrega proyectos en la tabla <code>proyecto</code>.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18,
          }}>
            {obras.map(obra => (
              <TarjetaObra key={obra.id} obra={obra} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
