import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

// ── Detalle interfaces ───────────────────────────────────────

export interface PartidaDetalle {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  metrado: number
  precio_unitario: number
  total: number
  avance_fisico: number
  fecha_inicio: string | null
  fecha_fin: string | null
  responsable: string | null
  es_titulo?: boolean
  cotizacion_id?: string | null
}

export interface ContratoItem {
  id: string
  tipo: string
  numero: string
  monto: number
  moneda: string
  fecha_firma: string
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string
}

export interface CostoItem {
  id: string
  categoria: string
  descripcion: string
  monto: number
  fecha: string
}

export interface FacturaItem {
  id: string
  tipo: 'emitida' | 'recibida'
  serie_numero: string
  nombre_contraparte: string | null
  total: number
  estado: string
  fecha_emision: string
  fecha_vencimiento: string | null
}

export interface CertificacionItem {
  id: string
  numero: number
  monto: number
  estado: string
  fecha: string
  descripcion: string | null
}

export interface FlujoItem {
  id: string
  tipo: 'cobro' | 'pago'
  descripcion: string
  monto: number
  fecha_esperada: string
}

export interface CotizacionResumen {
  id: string
  numero_cot: string
  revision: string
  fecha: string | null
  total: number
  estado: string
  created_at: string
}

export interface ObraDetalle {
  id: string
  codigo: string
  nombre: string
  cliente: string
  tipo: string
  estado: string
  ubicacion: string | null
  imagen_url: string | null
  presupuesto_contrato: number
  presupuesto_costo: number
  avance_fisico: number
  fecha_inicio: string | null
  fecha_fin_contrato: string | null
  // calculados
  costo_acumulado: number
  margen: number
  avance_esperado: number
  desvio_tiempo: number
  dias_restantes: number
  atrasado: boolean
  nivel_riesgo: 'ok' | 'medio' | 'alto' | 'critico'
  facturado: number
  cobrado: number
  // relacionados
  partidas: PartidaDetalle[]
  contratos: ContratoItem[]
  costos: CostoItem[]
  facturas: FacturaItem[]
  certificaciones: CertificacionItem[]
  flujo: FlujoItem[]
  cotizaciones: CotizacionResumen[]
}

export async function getObraDetalle(id: string): Promise<ObraDetalle | null> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()

  const { data: p } = await supabase
    .from('proyecto')
    .select('id,codigo,nombre,cliente,tipo,estado,ubicacion,imagen_url,presupuesto_contrato,presupuesto_costo,avance_fisico,fecha_inicio,fecha_fin_contrato')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .single()

  if (!p) return null

  const [
    { data: partidas },
    { data: contratos },
    { data: costos },
    { data: facturas },
    { data: certs },
    { data: flujo },
    { data: cotizaciones },
  ] = await Promise.all([
    supabase.from('partida').select('id,codigo,descripcion,unidad,metrado,precio_unitario,total,avance_fisico,fecha_inicio,fecha_fin,responsable,es_titulo,cotizacion_id').eq('proyecto_id', id).order('codigo'),
    supabase.from('contrato').select('id,tipo,numero,monto,moneda,fecha_firma,fecha_inicio,fecha_fin,estado').eq('proyecto_id', id),
    supabase.from('costo_directo').select('id,categoria,descripcion,monto,fecha').eq('proyecto_id', id).order('fecha', { ascending: false }),
    supabase.from('factura').select('id,tipo,serie_numero,nombre_contraparte,total,estado,fecha_emision,fecha_vencimiento').eq('proyecto_id', id).order('fecha_emision', { ascending: false }),
    supabase.from('certificacion').select('id,numero,monto,estado,fecha,descripcion').eq('proyecto_id', id).order('numero', { ascending: false }),
    supabase.from('flujo_caja_proyectado').select('id,tipo,descripcion,monto,fecha_esperada').eq('proyecto_id', id).eq('realizado', false).order('fecha_esperada'),
    supabase.from('cotizacion').select('id,numero_cot,revision,fecha,total,estado,created_at').eq('proyecto_id', id).order('created_at', { ascending: false }),
  ])

  const today          = new Date()
  const costoAcumulado = (costos ?? []).reduce((s, c) => s + c.monto, 0)
  const margen         = p.presupuesto_contrato > 0 ? Math.round((p.presupuesto_contrato - costoAcumulado) / p.presupuesto_contrato * 100) : 0
  const facturado      = (facturas ?? []).filter(f => f.tipo === 'emitida').reduce((s, f) => s + f.total, 0)
  const cobrado        = (facturas ?? []).filter(f => f.tipo === 'emitida' && f.estado === 'pagada').reduce((s, f) => s + f.total, 0)

  const fechaIni = p.fecha_inicio ? new Date(p.fecha_inicio) : null
  const fechaFin = p.fecha_fin_contrato ? new Date(p.fecha_fin_contrato) : null
  let avanceEsperado = 0, diasRestantes = 0, atrasado = false

  if (fechaIni && fechaFin) {
    const totalDias = (fechaFin.getTime() - fechaIni.getTime()) / 86400000
    avanceEsperado  = Math.min(100, Math.round(Math.max(0, (today.getTime() - fechaIni.getTime()) / 86400000) / totalDias * 100))
    const raw       = Math.round((fechaFin.getTime() - today.getTime()) / 86400000)
    atrasado        = raw < 0
    diasRestantes   = Math.abs(raw)
  }

  const desvioTiempo = p.avance_fisico - avanceEsperado
  let nivel_riesgo: ObraDetalle['nivel_riesgo'] = 'ok'
  if (atrasado || desvioTiempo < -20 || margen < 5)       nivel_riesgo = 'critico'
  else if (desvioTiempo < -10 || margen < 10)             nivel_riesgo = 'alto'
  else if (desvioTiempo < -5 || (diasRestantes < 30 && !atrasado)) nivel_riesgo = 'medio'

  return {
    ...p,
    ubicacion: p.ubicacion ?? null,
    imagen_url: p.imagen_url ?? null,
    costo_acumulado: costoAcumulado,
    margen,
    avance_esperado: avanceEsperado,
    desvio_tiempo: desvioTiempo,
    dias_restantes: diasRestantes,
    atrasado,
    nivel_riesgo,
    facturado,
    cobrado,
    partidas:      (partidas      ?? []) as PartidaDetalle[],
    contratos:     (contratos     ?? []) as ContratoItem[],
    costos:        (costos        ?? []) as CostoItem[],
    facturas:      (facturas      ?? []) as FacturaItem[],
    certificaciones: (certs       ?? []) as CertificacionItem[],
    flujo:         (flujo         ?? []) as FlujoItem[],
    cotizaciones:  (cotizaciones  ?? []) as CotizacionResumen[],
  }
}

export interface ObraCard {
  id: string
  codigo: string
  nombre: string
  cliente: string
  tipo: string
  estado: string
  presupuesto_contrato: number
  avance_fisico: number
  fecha_inicio: string | null
  fecha_fin_contrato: string | null
  imagen_url: string | null
  // calculados
  costo_acumulado: number
  margen: number
  avance_esperado: number
  desvio_tiempo: number
  dias_restantes: number
  atrasado: boolean
  nivel_riesgo: 'ok' | 'medio' | 'alto' | 'critico'
}

export interface KpiObras {
  total: number
  monto_contratado: number
  en_riesgo: number
  por_vencer: number  // < 30 días o atrasados
}

export async function getObras(): Promise<{ obras: ObraCard[]; kpis: KpiObras }> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()

  const { data: proyectos } = await supabase
    .from('proyecto')
    .select('id, codigo, nombre, cliente, tipo, estado, presupuesto_contrato, avance_fisico, fecha_inicio, fecha_fin_contrato, imagen_url')
    .eq('empresa_id', empresaId)
    .in('estado', ['activo', 'pausado'])
    .not('codigo', 'like', 'GG-%')
    .order('fecha_inicio', { ascending: false })

  if (!proyectos || proyectos.length === 0) {
    return { obras: [], kpis: { total: 0, monto_contratado: 0, en_riesgo: 0, por_vencer: 0 } }
  }

  const ids = proyectos.map(p => p.id)

  const { data: costos } = await supabase
    .from('costo_directo')
    .select('proyecto_id, monto')
    .in('proyecto_id', ids)

  const today = new Date()

  const obras: ObraCard[] = proyectos.map(p => {
    const costoAcumulado = (costos ?? [])
      .filter(c => c.proyecto_id === p.id)
      .reduce((s, c) => s + c.monto, 0)

    const margen = p.presupuesto_contrato > 0
      ? Math.round((p.presupuesto_contrato - costoAcumulado) / p.presupuesto_contrato * 100)
      : 0

    const fechaIni = p.fecha_inicio ? new Date(p.fecha_inicio) : null
    const fechaFin = p.fecha_fin_contrato ? new Date(p.fecha_fin_contrato) : null

    let avanceEsperado = 0
    let diasRestantes  = 0
    let atrasado       = false

    if (fechaIni && fechaFin) {
      const totalDias    = (fechaFin.getTime() - fechaIni.getTime()) / 86400000
      const diasElapsed  = (today.getTime() - fechaIni.getTime()) / 86400000
      avanceEsperado     = Math.min(100, Math.round(Math.max(0, diasElapsed) / totalDias * 100))
      const raw          = Math.round((fechaFin.getTime() - today.getTime()) / 86400000)
      atrasado           = raw < 0
      diasRestantes      = Math.abs(raw)
    }

    const desvioTiempo = p.avance_fisico - avanceEsperado

    let nivel_riesgo: ObraCard['nivel_riesgo'] = 'ok'
    if (atrasado || desvioTiempo < -20 || margen < 5)            nivel_riesgo = 'critico'
    else if (desvioTiempo < -10 || margen < 10)                  nivel_riesgo = 'alto'
    else if (desvioTiempo < -5  || (diasRestantes < 30 && !atrasado)) nivel_riesgo = 'medio'

    return {
      id: p.id, codigo: p.codigo, nombre: p.nombre, cliente: p.cliente,
      tipo: p.tipo, estado: p.estado,
      presupuesto_contrato: p.presupuesto_contrato,
      avance_fisico: p.avance_fisico,
      fecha_inicio: p.fecha_inicio,
      fecha_fin_contrato: p.fecha_fin_contrato,
      imagen_url: p.imagen_url ?? null,
      costo_acumulado: costoAcumulado,
      margen,
      avance_esperado: avanceEsperado,
      desvio_tiempo: desvioTiempo,
      dias_restantes: diasRestantes,
      atrasado,
      nivel_riesgo,
    }
  })

  const kpis: KpiObras = {
    total:             obras.length,
    monto_contratado:  obras.reduce((s, o) => s + o.presupuesto_contrato, 0),
    en_riesgo:         obras.filter(o => ['alto','critico'].includes(o.nivel_riesgo)).length,
    por_vencer:        obras.filter(o => o.atrasado || (!o.atrasado && o.dias_restantes < 30)).length,
  }

  return { obras, kpis }
}
