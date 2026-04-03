import { getReporteEjecutivo } from '@/lib/reportes'
import BannerEjecutivo        from '@/components/reportes/BannerEjecutivo'
import RentabilidadTrimestral from '@/components/reportes/RentabilidadTrimestral'
import PipelineLicitaciones   from '@/components/reportes/PipelineLicitaciones'
import RankingYExposicion     from '@/components/reportes/RankingYExposicion'
import RutaCritica            from '@/components/reportes/RutaCritica'

export default async function ReporteEjecutivoPage() {
  const {
    banner, proyectosTimeline, licitaciones,
    rentabilidadTrimestral, ranking, exposicion, backlogTotal,
  } = await getReporteEjecutivo()

  const anio = new Date().getFullYear()

  return (
    <div>
      {/* Topbar */}
      <div style={{
        padding: '12px 26px', borderBottom: '1px solid #E2E8F0',
        background: '#fff', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(15,23,42,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>
            Reporte Ejecutivo
            <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 10 }}>{anio}</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>Vista gerencial · Solo lectura</div>
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8' }}>
          Actualizado · {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Banner ejecutivo */}
        <BannerEjecutivo banner={banner} anio={anio} />

        {/* Rentabilidad + Pipeline */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12, alignItems: 'start' }}>
          <RentabilidadTrimestral data={rentabilidadTrimestral} backlog={backlogTotal} />
          <PipelineLicitaciones data={licitaciones} />
        </div>

        {/* Ranking + Exposición */}
        <RankingYExposicion ranking={ranking} exposicion={exposicion} />

        {/* Ruta crítica — full width */}
        <RutaCritica data={proyectosTimeline} />

      </div>
    </div>
  )
}
