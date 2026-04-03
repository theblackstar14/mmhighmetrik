import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'
import type {
  KpiDashboard, KpiDetalleItem,
  ProyectoResumen, ProyectoRiesgo,
  EgresoCategoria, EgresoDetalle,
  AlertaDashboard, SankeyFlow,
  VencimientoItem,
} from '@/lib/types/database'

export type Rango = 'mes' | 'mesant' | 'trim' | 'sem' | 'anio'

function calcularRango(rango: Rango, hoy: Date) {
  const y = hoy.getFullYear()
  const m = hoy.getMonth()

  switch (rango) {
    case 'mesant': {
      const ini = new Date(y, m - 1, 1)
      const fin = new Date(y, m, 0)
      const iniAnt = new Date(y, m - 2, 1)
      const finAnt = new Date(y, m - 1, 0)
      return { ini, fin, iniAnt, finAnt }
    }
    case 'trim': {
      const trimStart = Math.floor(m / 3) * 3
      const ini = new Date(y, trimStart, 1)
      const fin = new Date(y, trimStart + 3, 0)
      const iniAnt = new Date(y, trimStart - 3, 1)
      const finAnt = new Date(y, trimStart, 0)
      return { ini, fin, iniAnt, finAnt }
    }
    case 'sem': {
      const semStart = m < 6 ? 0 : 6
      const ini = new Date(y, semStart, 1)
      const fin = new Date(y, semStart + 6, 0)
      const iniAnt = new Date(y, semStart - 6, 1)
      const finAnt = new Date(y, semStart, 0)
      return { ini, fin, iniAnt, finAnt }
    }
    case 'anio': {
      const ini = new Date(y, 0, 1)
      const fin = new Date(y, 12, 0)
      const iniAnt = new Date(y - 1, 0, 1)
      const finAnt = new Date(y - 1, 12, 0)
      return { ini, fin, iniAnt, finAnt }
    }
    default: { // mes
      const ini = new Date(y, m, 1)
      const fin = new Date(y, m + 1, 0)
      const iniAnt = new Date(y, m - 1, 1)
      const finAnt = new Date(y, m, 0)
      return { ini, fin, iniAnt, finAnt }
    }
  }
}

const iso = (d: Date) => d.toISOString().split('T')[0]

export async function getDashboardData(rango: Rango = 'mes') {
  const [supabase, empresaId] = await Promise.all([createClient(), getEmpresaId()])

  if (!empresaId) {
    return datosVacios()
  }

  const hoy = new Date()
  const { ini, fin, iniAnt, finAnt } = calcularRango(rango, hoy)
  const inicioP  = iso(ini)
  const finP     = iso(fin)
  const inicioAnt = iso(iniAnt)
  const finAnt_   = iso(finAnt)

  const [
    facturasEmitidas,
    facturasEmitidasAnt,
    costosMes,
    costosMesAnt,
    proyectos,
    facturasVencidas,
    certificacionesPendientes,
    flujoProyectado,
    costosPorCategoria,
    ingresosAnuales,
    egresosAnuales,
    facturasPagadas,
    vencimientosProximos,
  ] = await Promise.all([
    supabase.from('factura')
      .select('total, serie_numero, estado, fecha_emision, proyecto_id')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida')
      .gte('fecha_emision', inicioP).lte('fecha_emision', finP),

    supabase.from('factura')
      .select('total')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida')
      .gte('fecha_emision', inicioAnt).lte('fecha_emision', finAnt_),

    supabase.from('costo_directo')
      .select('monto, proyecto_id')
      .eq('empresa_id', empresaId)
      .gte('fecha', inicioP).lte('fecha', finP),

    supabase.from('costo_directo')
      .select('monto')
      .eq('empresa_id', empresaId)
      .gte('fecha', inicioAnt).lte('fecha', finAnt_),

    supabase.from('proyecto')
      .select('id, nombre, cliente, presupuesto_contrato, presupuesto_costo, avance_fisico, estado, fecha_inicio, fecha_fin_contrato')
      .eq('empresa_id', empresaId).eq('estado', 'activo')
      .not('codigo', 'like', 'GG-%'),

    supabase.from('factura')
      .select('id, serie_numero, total, fecha_vencimiento, tipo')
      .eq('empresa_id', empresaId).eq('estado', 'vencida'),

    supabase.from('certificacion')
      .select('id, numero, monto, proyecto_id, estado'),

    supabase.from('flujo_caja_proyectado')
      .select('tipo, monto, fecha_esperada, descripcion, origen')
      .eq('empresa_id', empresaId).eq('realizado', false)
      .gte('fecha_esperada', iso(hoy))
      .lte('fecha_esperada', iso(new Date(hoy.getTime() + 30 * 86400000))),

    supabase.from('costo_directo')
      .select('categoria, monto, descripcion, proyecto_id')
      .eq('empresa_id', empresaId)
      .gte('fecha', inicioP).lte('fecha', finP),

    supabase.from('factura')
      .select('total, fecha_emision')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida')
      .gte('fecha_emision', `${hoy.getFullYear()}-01-01`)
      .lte('fecha_emision', `${hoy.getFullYear()}-12-31`),

    supabase.from('costo_directo')
      .select('monto, fecha, categoria')
      .eq('empresa_id', empresaId)
      .gte('fecha', `${hoy.getFullYear()}-01-01`)
      .lte('fecha', `${hoy.getFullYear()}-12-31`),

    // Para DSO: facturas cobradas con fecha_pago
    supabase.from('factura')
      .select('fecha_emision, fecha_pago')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida').eq('estado', 'pagada')
      .not('fecha_pago', 'is', null)
      .limit(200),

    // Vencimientos próximos 30 días (cobros y pagos)
    supabase.from('flujo_caja_proyectado')
      .select('id, tipo, monto, fecha_esperada, descripcion, origen')
      .eq('empresa_id', empresaId).eq('realizado', false)
      .gte('fecha_esperada', iso(hoy))
      .lte('fecha_esperada', iso(new Date(hoy.getTime() + 30 * 86400000)))
      .order('fecha_esperada', { ascending: true }),
  ])

  // ── KPIs ──────────────────────────────────────────────────
  const ingresosMes    = (facturasEmitidas.data || []).reduce((s, f) => s + f.total, 0)
  const ingresosMesAnt = (facturasEmitidasAnt.data || []).reduce((s, f) => s + f.total, 0)
  const egresosMes     = (costosMes.data || []).reduce((s, c) => s + c.monto, 0)
  const egresosMesAnt  = (costosMesAnt.data || []).reduce((s, c) => s + c.monto, 0)
  const utilidadMes    = ingresosMes - egresosMes
  const utilidadMesAnt = ingresosMesAnt - egresosMesAnt

  const varPct = (a: number, b: number) =>
    b === 0 ? 0 : Math.round(((a - b) / b) * 100 * 10) / 10

  // DSO — promedio días entre emisión y cobro
  const factPagadas = facturasPagadas.data || []
  const dso = factPagadas.length === 0 ? 0 : Math.round(
    factPagadas.reduce((s, f) => {
      const dias = (new Date(f.fecha_pago!).getTime() - new Date(f.fecha_emision).getTime()) / 86400000
      return s + dias
    }, 0) / factPagadas.length
  )

  const flujoData = flujoProyectado.data || []
  const kpis: KpiDashboard = {
    ingresos_mes:        ingresosMes,
    egresos_mes:         egresosMes,
    utilidad_mes:        utilidadMes,
    flujo_proyectado:    flujoData.filter(f => f.tipo === 'cobro').reduce((s, f) => s + f.monto, 0)
                       - flujoData.filter(f => f.tipo === 'pago').reduce((s, f) => s + f.monto, 0),
    variacion_ingresos:  varPct(ingresosMes, ingresosMesAnt),
    variacion_egresos:   varPct(egresosMes, egresosMesAnt),
    variacion_utilidad:  varPct(utilidadMes, utilidadMesAnt),
    dso,
  }

  // ── Detalles para KPI modales ──────────────────────────────
  const proyMap = Object.fromEntries((proyectos.data || []).map(p => [p.id, p.nombre]))

  const kpiDetalles: Record<string, KpiDetalleItem[]> = {
    ingresos: (facturasEmitidas.data || [])
      .sort((a, b) => b.total - a.total)
      .map(f => ({
        label: f.serie_numero,
        sub: proyMap[f.proyecto_id ?? ''] ?? '—',
        monto: f.total,
        estado: f.estado,
        fecha: f.fecha_emision,
      })),
    egresos: (costosPorCategoria.data || [])
      .sort((a: any, b: any) => b.monto - a.monto)
      .map((c: any) => ({
        label: c.descripcion,
        sub: proyMap[c.proyecto_id] ?? '—',
        monto: c.monto,
        estado: c.categoria,
      })),
    flujo: (vencimientosProximos.data || []).map(v => ({
      label: v.descripcion,
      sub: v.origen,
      monto: v.monto,
      estado: v.tipo,
      fecha: v.fecha_esperada,
    })),
  }

  // ── PROYECTOS con margen y riesgo ─────────────────────────
  const proyectosResumen: ProyectoResumen[] = (proyectos.data || []).map(p => {
    const margen = p.presupuesto_contrato > 0
      ? Math.round(((p.presupuesto_contrato - p.presupuesto_costo) / p.presupuesto_contrato) * 1000) / 10
      : 0
    return { ...p, margen }
  })

  const proyectosEnRiesgo: ProyectoRiesgo[] = (proyectos.data || [])
    .filter(p => p.fecha_inicio && p.fecha_fin_contrato)
    .map(p => {
      const inicio   = new Date(p.fecha_inicio!)
      const fin      = new Date(p.fecha_fin_contrato!)
      const duracion = fin.getTime() - inicio.getTime()
      const transcurrido = Math.max(0, hoy.getTime() - inicio.getTime())
      const avanceEsperado = Math.min(100, Math.round((transcurrido / duracion) * 100))
      const desviacion = p.avance_fisico - avanceEsperado
      const diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / 86400000)
      return {
        id: p.id,
        nombre: p.nombre,
        cliente: p.cliente,
        avance_fisico: p.avance_fisico,
        avance_esperado: avanceEsperado,
        desviacion,
        dias_restantes: diasRestantes,
        fecha_fin_contrato: p.fecha_fin_contrato!,
      }
    })
    .filter(p => p.desviacion < -10 || p.dias_restantes < 30)
    .sort((a, b) => a.desviacion - b.desviacion)

  // ── EGRESOS POR CATEGORÍA ─────────────────────────────────
  const CAT_LABELS: Record<string, string> = {
    material: 'Materiales', subcontrato: 'Subcontratos', mano_obra: 'Mano de obra',
    alquiler: 'Alquileres', administracion: 'Administración', impuesto: 'Impuestos',
  }
  const catMap: Record<string, number> = {}
  const detallesCategorias: Record<string, EgresoDetalle[]> = {}
  ;(costosPorCategoria.data || []).forEach((c: any) => {
    catMap[c.categoria] = (catMap[c.categoria] || 0) + c.monto
    if (!detallesCategorias[c.categoria]) detallesCategorias[c.categoria] = []
    detallesCategorias[c.categoria].push({
      descripcion: c.descripcion,
      monto: c.monto,
      proyecto: proyMap[c.proyecto_id] ?? '—',
    })
  })
  Object.keys(detallesCategorias).forEach(k => detallesCategorias[k].sort((a, b) => b.monto - a.monto))
  const totalEgresos = Object.values(catMap).reduce((s, v) => s + v, 0) || 1
  const egresosCategorias: EgresoCategoria[] = Object.entries(catMap).map(([cat, total]) => ({
    categoria: cat as any,
    total,
    porcentaje: Math.round((total / totalEgresos) * 100),
  }))

  // ── GRÁFICO ANUAL ─────────────────────────────────────────
  const mesesAnual = Array.from({ length: 12 }, (_, i) => {
    const mes = String(i + 1).padStart(2, '0')
    const prefix = `${hoy.getFullYear()}-${mes}`
    const ing = (ingresosAnuales.data || []).filter(f => f.fecha_emision.startsWith(prefix)).reduce((s, f) => s + f.total, 0)
    const egr = (egresosAnuales.data || []).filter(f => f.fecha.startsWith(prefix)).reduce((s, f) => s + f.monto, 0)
    return { mes: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i], ingresos: ing, egresos: egr }
  })

  // ── SANKEY ────────────────────────────────────────────────
  const catAnualMap: Record<string, number> = {}
  ;(egresosAnuales.data || []).forEach((e: any) => {
    catAnualMap[e.categoria] = (catAnualMap[e.categoria] || 0) + e.monto
  })
  const totalIngresosAnual = (ingresosAnuales.data || []).reduce((s, f) => s + f.total, 0)
  const totalEgresosAnual  = Object.values(catAnualMap).reduce((s, v) => s + v, 0)
  const utilidadAnual = totalIngresosAnual - totalEgresosAnual
  const sankeyData: SankeyFlow[] = [
    ...Object.entries(catAnualMap)
      .filter(([, v]) => v > 0)
      .map(([cat, total]) => ({ from: 'Ingresos', to: CAT_LABELS[cat] || cat, flow: Math.round(total) })),
    ...(utilidadAnual > 0
      ? [{ from: 'Ingresos', to: 'Utilidad neta', flow: Math.round(utilidadAnual) }]
      : [{ from: 'Pérdida', to: 'Egresos', flow: Math.round(Math.abs(utilidadAnual)) }]),
  ]

  // ── ALERTAS ───────────────────────────────────────────────
  const alertas: AlertaDashboard[] = []
  const vencidas = (facturasVencidas.data || []).filter(f => f.tipo === 'emitida')
  if (vencidas.length > 0) {
    alertas.push({
      id: 'fact-vencidas',
      tipo: 'error',
      titulo: `${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} por cobrar`,
      descripcion: 'Requieren seguimiento inmediato',
      monto: vencidas.reduce((s, f) => s + f.total, 0),
      ruta: '/facturacion',
    })
  }
  ;(certificacionesPendientes.data || []).forEach(c => {
    alertas.push({
      id: `cert-${c.id}`,
      tipo: 'info',
      titulo: `Certificación N°${c.numero} pendiente de aprobación`,
      descripcion: 'Lista para emitir',
      monto: c.monto,
      ruta: '/obras',
    })
  })

  // ── VENCIMIENTOS PRÓXIMOS ─────────────────────────────────
  const vencimientos: VencimientoItem[] = (vencimientosProximos.data || []).map(v => ({
    id: v.id,
    descripcion: v.descripcion,
    tipo: v.tipo as 'cobro' | 'pago',
    monto: v.monto,
    fecha: v.fecha_esperada,
    dias_para_vencer: Math.ceil((new Date(v.fecha_esperada).getTime() - hoy.getTime()) / 86400000),
    origen: v.origen,
  }))

  return {
    kpis,
    kpiDetalles,
    proyectosResumen,
    proyectosEnRiesgo,
    egresosCategorias,
    detallesCategorias,
    mesesAnual,
    alertas,
    sankeyData,
    vencimientos,
    flujoSemanas: flujoData,
  }
}

function datosVacios() {
  const kpis: KpiDashboard = {
    ingresos_mes: 0, egresos_mes: 0, utilidad_mes: 0,
    flujo_proyectado: 0, variacion_ingresos: 0,
    variacion_egresos: 0, variacion_utilidad: 0, dso: 0,
  }
  return {
    kpis, kpiDetalles: {} as Record<string, KpiDetalleItem[]>, proyectosResumen: [],
    proyectosEnRiesgo: [], egresosCategorias: [],
    detallesCategorias: {}, mesesAnual: [], alertas: [],
    sankeyData: [], vencimientos: [], flujoSemanas: [],
  }
}
