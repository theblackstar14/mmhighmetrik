import { getDashboardData, type Rango } from '@/lib/dashboard'
import KpiCard from '@/components/dashboard/KpiCard'
import GraficoIE from '@/components/dashboard/GraficoIE'
import GraficoEgresos from '@/components/dashboard/GraficoEgresos'
import GraficoRentabilidad from '@/components/dashboard/GraficoRentabilidad'
import TablaObras from '@/components/dashboard/TablaObras'
import PanelAlertas from '@/components/dashboard/PanelAlertas'
import AsistenteIA from '@/components/dashboard/AsistenteIA'
import GraficoSankey from '@/components/dashboard/GraficoSankey'
import FiltroFechas from '@/components/dashboard/FiltroFechas'
import RealtimeRefresher from '@/components/dashboard/RealtimeRefresher'
import WidgetVencimientos from '@/components/dashboard/WidgetVencimientos'
import ProyectosEnRiesgo from '@/components/dashboard/ProyectosEnRiesgo'

const RANGO_LABELS: Record<Rango, string> = {
  mes:    'Este mes',
  mesant: 'Mes anterior',
  trim:   'Trimestre',
  sem:    'Semestre',
  anio:   'Este año',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>
}) {
  const { rango: rangoParam } = await searchParams
  const rango = (['mes','mesant','trim','sem','anio'].includes(rangoParam ?? '')
    ? rangoParam as Rango
    : 'mes')

  const {
    kpis, kpiDetalles,
    proyectosResumen, proyectosEnRiesgo,
    egresosCategorias, detallesCategorias,
    mesesAnual, alertas, sankeyData,
    vencimientos,
  } = await getDashboardData(rango)

  return (
    <div>
      {/* TOPBAR */}
      <div style={{
        padding: '12px 26px', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(15,23,42,.06)',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>
            Resumen ejecutivo
            <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 10 }}>
              {RANGO_LABELS[rango]}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>Constructora Horizonte SAC</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <RealtimeRefresher />
          <FiltroFechas />
        </div>
      </div>

      <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* KPIs — 5 tarjetas con DSO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          <KpiCard
            label="Ingresos del período"
            valor={kpis.ingresos_mes}
            variacion={kpis.variacion_ingresos}
            color="blue"
            detalles={kpiDetalles.ingresos}
            detalleLabel="Facturas emitidas"
          />
          <KpiCard
            label="Egresos del período"
            valor={kpis.egresos_mes}
            variacion={kpis.variacion_egresos}
            color="red"
            detalles={kpiDetalles.egresos}
            detalleLabel="Costos directos"
          />
          <KpiCard
            label="Utilidad neta"
            valor={kpis.utilidad_mes}
            variacion={kpis.variacion_utilidad}
            color="green"
          />
          <KpiCard
            label="Flujo proyectado 30d"
            valor={kpis.flujo_proyectado}
            variacion={0}
            color="amber"
            detalles={kpiDetalles.flujo}
            detalleLabel="Flujo de caja próximo"
          />
          <KpiCard
            label="DSO (días cobro)"
            valor={kpis.dso}
            variacion={0}
            color="indigo"
            detalleLabel="Días promedio de cobro"
          />
        </div>

        {/* Gráficos fila 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <GraficoIE data={mesesAnual} />
          <GraficoEgresos data={egresosCategorias} detalles={detallesCategorias} />
        </div>

        {/* Gráficos fila 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GraficoRentabilidad data={proyectosResumen} />
          <TablaObras data={proyectosResumen} />
        </div>

        {/* Alertas + Asistente */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <PanelAlertas data={alertas} />
          <AsistenteIA />
        </div>

        {/* Vencimientos + Proyectos en riesgo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <WidgetVencimientos data={vencimientos} />
          <ProyectosEnRiesgo data={proyectosEnRiesgo} />
        </div>

        {/* Sankey */}
        <GraficoSankey data={sankeyData} detalles={detallesCategorias} />

      </div>
    </div>
  )
}
