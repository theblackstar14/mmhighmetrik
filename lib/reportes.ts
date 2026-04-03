import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

const iso = (d: Date) => d.toISOString().split('T')[0]

export interface ProyectoTimeline {
  id: string
  codigo: string
  nombre: string
  cliente: string
  avance_fisico: number
  avance_esperado: number
  desviacion: number
  fecha_inicio: string
  fecha_fin: string
  dias_total: number
  dias_transcurridos: number
  dias_restantes: number
  velocidad_diaria: number        // % por día al ritmo actual
  fecha_fin_estimada: string      // basada en velocidad actual
  estado: string
  riesgo: 'ok' | 'medio' | 'alto' | 'critico'
}

export interface LicitacionResumen {
  id: string
  codigo: string
  nombre: string
  entidad: string
  tipo: string
  estado: string
  monto_referencial: number | null
  fecha_presentacion: string | null
}

export interface RentabilidadTrimestre {
  trimestre: string
  ingresos: number
  egresos: number
  utilidad: number
  margen: number
}

export interface ProyectoRanking {
  id: string
  nombre: string
  cliente: string
  margen: number
  presupuesto_contrato: number
  avance_fisico: number
}

export interface ExposicionItem {
  bucket: string
  monto: number
  cantidad: number
  color: string
}

export async function getReporteEjecutivo() {
  const [supabase, empresaId] = await Promise.all([createClient(), getEmpresaId()])
  if (!empresaId) return reporteVacio()

  const hoy = new Date()
  const inicioAnio = `${hoy.getFullYear()}-01-01`
  const finAnio    = `${hoy.getFullYear()}-12-31`

  const [
    proyectos,
    licitaciones,
    facturasAnuales,
    costosAnuales,
    facturasPendientes,
    certificacionesCobradas,
  ] = await Promise.all([
    supabase.from('proyecto')
      .select('id, codigo, nombre, cliente, avance_fisico, estado, presupuesto_contrato, presupuesto_costo, fecha_inicio, fecha_fin_contrato')
      .eq('empresa_id', empresaId)
      .in('estado', ['activo', 'pausado']),

    supabase.from('licitacion')
      .select('id, codigo, nombre, entidad, tipo, estado, monto_referencial, fecha_presentacion')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase.from('factura')
      .select('total, fecha_emision')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida')
      .gte('fecha_emision', inicioAnio).lte('fecha_emision', finAnio),

    supabase.from('costo_directo')
      .select('monto, fecha')
      .gte('fecha', inicioAnio).lte('fecha', finAnio),

    // AR por antigüedad (facturas pendientes/vencidas)
    supabase.from('factura')
      .select('total, fecha_emision, estado')
      .eq('empresa_id', empresaId).eq('tipo', 'emitida')
      .in('estado', ['pendiente', 'vencida']),

    // Backlog: certificaciones cobradas para restar al contrato
    supabase.from('certificacion')
      .select('monto, proyecto_id, estado'),
  ])

  // ── RUTA CRÍTICA: timeline por proyecto ──────────────────
  const proyectosTimeline: ProyectoTimeline[] = (proyectos.data || [])
    .filter(p => p.fecha_inicio && p.fecha_fin_contrato)
    .map(p => {
      const ini = new Date(p.fecha_inicio!)
      const fin = new Date(p.fecha_fin_contrato!)
      const diasTotal        = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / 86400000))
      const diasTranscurridos = Math.max(0, Math.ceil((hoy.getTime() - ini.getTime()) / 86400000))
      const diasRestantes    = Math.ceil((fin.getTime() - hoy.getTime()) / 86400000)
      const avanceEsperado   = Math.min(100, Math.round((diasTranscurridos / diasTotal) * 100))
      const desviacion       = p.avance_fisico - avanceEsperado

      // Velocidad actual: % / día
      const velocidadDiaria  = diasTranscurridos > 0 ? p.avance_fisico / diasTranscurridos : 0
      const diasParaTerminar = velocidadDiaria > 0 ? Math.ceil((100 - p.avance_fisico) / velocidadDiaria) : 9999
      const finEstimado      = new Date(hoy.getTime() + diasParaTerminar * 86400000)

      const riesgo: ProyectoTimeline['riesgo'] =
        diasRestantes < 0         ? 'critico'
        : desviacion < -20        ? 'critico'
        : desviacion < -10        ? 'alto'
        : diasRestantes < 30      ? 'medio'
        : 'ok'

      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cliente: p.cliente,
        avance_fisico: p.avance_fisico,
        avance_esperado: avanceEsperado,
        desviacion,
        fecha_inicio: p.fecha_inicio!,
        fecha_fin: p.fecha_fin_contrato!,
        dias_total: diasTotal,
        dias_transcurridos: Math.min(diasTotal, diasTranscurridos),
        dias_restantes: diasRestantes,
        velocidad_diaria: Math.round(velocidadDiaria * 100) / 100,
        fecha_fin_estimada: iso(finEstimado),
        estado: p.estado,
        riesgo,
      }
    })
    .sort((a, b) => a.desviacion - b.desviacion)

  // ── PIPELINE LICITACIONES ─────────────────────────────────
  const licitacionesList: LicitacionResumen[] = (licitaciones.data || []).map(l => ({
    id: l.id,
    codigo: l.codigo,
    nombre: l.nombre,
    entidad: l.entidad,
    tipo: l.tipo,
    estado: l.estado,
    monto_referencial: l.monto_referencial,
    fecha_presentacion: l.fecha_presentacion,
  }))

  // ── RENTABILIDAD TRIMESTRAL ───────────────────────────────
  const rentabilidadTrimestral: RentabilidadTrimestre[] = [1, 2, 3, 4].map(q => {
    const mIni = (q - 1) * 3
    const mFin = q * 3
    const label = `Q${q} ${hoy.getFullYear()}`
    const ing = (facturasAnuales.data || []).filter(f => {
      const m = new Date(f.fecha_emision).getMonth()
      return m >= mIni && m < mFin
    }).reduce((s, f) => s + f.total, 0)
    const egr = (costosAnuales.data || []).filter(c => {
      const m = new Date(c.fecha).getMonth()
      return m >= mIni && m < mFin
    }).reduce((s, c) => s + c.monto, 0)
    const utilidad = ing - egr
    const margen = ing > 0 ? Math.round((utilidad / ing) * 100 * 10) / 10 : 0
    return { trimestre: label, ingresos: ing, egresos: egr, utilidad, margen }
  })

  // ── BACKLOG DE OBRA ───────────────────────────────────────
  const certsCobradas = (certificacionesCobradas.data || []).filter(c => c.estado === 'cobrada')
  const certsPorProyecto: Record<string, number> = {}
  certsCobradas.forEach(c => {
    certsPorProyecto[c.proyecto_id] = (certsPorProyecto[c.proyecto_id] || 0) + c.monto
  })
  const backlogTotal = (proyectos.data || []).reduce((s, p) => {
    const cobrado = certsPorProyecto[p.id] ?? 0
    return s + Math.max(0, p.presupuesto_contrato - cobrado)
  }, 0)

  // ── RANKING PROYECTOS ─────────────────────────────────────
  const ranking: ProyectoRanking[] = (proyectos.data || []).map(p => ({
    id: p.id,
    nombre: p.nombre,
    cliente: p.cliente,
    margen: p.presupuesto_contrato > 0
      ? Math.round(((p.presupuesto_contrato - p.presupuesto_costo) / p.presupuesto_contrato) * 1000) / 10
      : 0,
    presupuesto_contrato: p.presupuesto_contrato,
    avance_fisico: p.avance_fisico,
  })).sort((a, b) => b.margen - a.margen)

  // ── EXPOSICIÓN FINANCIERA (AR por antigüedad) ─────────────
  const pendientes = facturasPendientes.data || []
  const exposicion: ExposicionItem[] = [
    { bucket: '0–30 días',  dias: [0, 30],  color: '#059669' },
    { bucket: '31–60 días', dias: [31, 60], color: '#D97706' },
    { bucket: '61–90 días', dias: [61, 90], color: '#DC2626' },
    { bucket: '> 90 días',  dias: [91, 9999], color: '#7F1D1D' },
  ].map(b => {
    const items = pendientes.filter(f => {
      const edad = Math.floor((hoy.getTime() - new Date(f.fecha_emision).getTime()) / 86400000)
      return edad >= (b as any).dias[0] && edad <= (b as any).dias[1]
    })
    return {
      bucket: b.bucket,
      monto: items.reduce((s, f) => s + f.total, 0),
      cantidad: items.length,
      color: b.color,
    }
  })

  // ── BANNER EJECUTIVO ──────────────────────────────────────
  const totalIngAnio = (facturasAnuales.data || []).reduce((s, f) => s + f.total, 0)
  const totalEgrAnio = (costosAnuales.data || []).reduce((s, c) => s + c.monto, 0)
  const margenAnio   = totalIngAnio > 0 ? Math.round(((totalIngAnio - totalEgrAnio) / totalIngAnio) * 100) : 0
  const proyRiesgo   = proyectosTimeline.filter(p => p.riesgo === 'alto' || p.riesgo === 'critico').length
  const totalAR      = exposicion.reduce((s, e) => s + e.monto, 0)

  const banner = {
    ingresos_anio: totalIngAnio,
    margen_anio:   margenAnio,
    proyectos_riesgo: proyRiesgo,
    total_por_cobrar: totalAR,
    backlog: backlogTotal,
  }

  return {
    banner,
    proyectosTimeline,
    licitaciones: licitacionesList,
    rentabilidadTrimestral,
    ranking,
    exposicion,
    backlogTotal,
  }
}

function reporteVacio() {
  return {
    banner: { ingresos_anio: 0, margen_anio: 0, proyectos_riesgo: 0, total_por_cobrar: 0, backlog: 0 },
    proyectosTimeline: [],
    licitaciones: [],
    rentabilidadTrimestral: [],
    ranking: [],
    exposicion: [],
    backlogTotal: 0,
  }
}
