import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

// ── Estado de resultados ──────────────────────────────────────
export interface FilaEstadoResultados {
  mes:      string
  ingresos: number
  egresos:  number
  utilidad: number
}

// ── Ingresos ──────────────────────────────────────────────────
export interface FilaIngreso {
  id:                 string
  serie_numero:       string
  nombre_contraparte: string | null
  proyecto_nombre:    string | null
  total:              number
  fecha_emision:      string
  fecha_pago:         string | null
  estado:             string
}

// ── Egresos ───────────────────────────────────────────────────
export interface FilaEgreso {
  id:              string
  descripcion:     string
  proyecto_nombre: string | null
  centro_costo:    string
  categoria:       string
  medio_pago:      string
  monto:           number
  fecha:           string
  comprobante:     string | null
}

// ── Cuentas por cobrar ────────────────────────────────────────
export interface FilaCuentaCobrar {
  id:                 string
  serie_numero:       string
  nombre_contraparte: string | null
  proyecto_nombre:    string | null
  total:              number
  fecha_emision:      string
  fecha_vencimiento:  string | null
  dias_vencida:       number
  estado:             string
}

// ── Financiero por obra ───────────────────────────────────────
export interface CategoriaEgreso {
  categoria: string
  total:     number
  cantidad:  number
}
export interface FilaObraFinanciero {
  proyecto_id:          string
  proyecto_codigo:      string
  proyecto_nombre:      string
  cliente:              string
  presupuesto_contrato: number
  ingresos:             number
  egresos:              number
  utilidad:             number
  margen:               number
  egresos_categoria:    CategoriaEgreso[]
}

// ── Flujo proyectado ──────────────────────────────────────────
export interface FilaFlujo {
  id:             string
  tipo:           'cobro' | 'pago'
  descripcion:    string
  monto:          number
  fecha_esperada: string
  origen:         string | null
}

// ── Flujo real vs proyectado por mes ──────────────────────────
export interface FilaFlujoMes {
  mes:                string
  ingresos_real:      number
  egresos_real:       number
  cobros_proyectado:  number
  pagos_proyectado:   number
  flujo_real:         number
  flujo_proyectado:   number
}

// ── Resumen ejecutivo ─────────────────────────────────────────
export interface FilaResumenObra {
  id:                   string
  codigo:               string
  nombre:               string
  cliente:              string
  presupuesto_contrato: number
  costo_ejecutado:      number
  margen:               number
  avance_fisico:        number
  estado:               string
}

export interface DatosReportes {
  estadoResultados: FilaEstadoResultados[]
  ingresos:         FilaIngreso[]
  egresos:          FilaEgreso[]
  cuentasCobrar:    FilaCuentaCobrar[]
  obraFinanciero:   FilaObraFinanciero[]
  flujo30:          FilaFlujo[]
  flujo60:          FilaFlujo[]
  flujo90:          FilaFlujo[]
  flujoMes:         FilaFlujoMes[]
  resumenObras:     FilaResumenObra[]
  totalPorCobrar:   number
  totalVencido:     number
  totalCostosMes:   number
  totalIngresosMes: number
}

export async function getDatosReportes(): Promise<DatosReportes> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()
  const hoy       = new Date()
  const isoHoy    = hoy.toISOString().split('T')[0]

  const hace12 = new Date(hoy)
  hace12.setMonth(hace12.getMonth() - 11)
  hace12.setDate(1)
  const inicioAnio = `${hace12.getFullYear()}-${String(hace12.getMonth() + 1).padStart(2, '0')}-01`
  const inicioMes  = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: facturasRaw },
    { data: facturasXCobrar },
    { data: costosRaw },
    { data: proyectos },
    { data: flujoProyectadoRaw },
  ] = await Promise.all([
    // Facturas emitidas — incluye campos para tab Ingresos
    supabase.from('factura')
      .select('id, serie_numero, nombre_contraparte, total, fecha_emision, fecha_pago, estado, proyecto_id, proyecto:proyecto_id(nombre)')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'emitida')
      .gte('fecha_emision', inicioAnio)
      .order('fecha_emision', { ascending: false }),

    // Facturas pendientes → cuentas por cobrar
    supabase.from('factura')
      .select('id, serie_numero, nombre_contraparte, total, fecha_emision, fecha_vencimiento, estado, proyecto_id, proyecto:proyecto_id(nombre)')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'emitida')
      .neq('estado', 'pagada')
      .order('fecha_emision', { ascending: false }),

    // Costos directos — incluye campos para tab Egresos
    supabase.from('costo_directo')
      .select('id, descripcion, categoria, monto, fecha, centro_costo, medio_pago, comprobante, proyecto_id, proyecto:proyecto_id(codigo, nombre)')
      .eq('empresa_id', empresaId)
      .gte('fecha', inicioAnio)
      .order('fecha', { ascending: false }),

    // Proyectos activos (sin GG-*)
    supabase.from('proyecto')
      .select('id, codigo, nombre, cliente, presupuesto_contrato, presupuesto_costo, avance_fisico, estado')
      .eq('empresa_id', empresaId)
      .in('estado', ['activo', 'pausado'])
      .not('codigo', 'like', 'GG-%')
      .order('codigo'),

    // Flujo proyectado: próximos 90 días + pasados 12m para comparación
    supabase.from('flujo_caja_proyectado')
      .select('id, tipo, descripcion, monto, fecha_esperada, origen, realizado')
      .eq('empresa_id', empresaId)
      .gte('fecha_esperada', inicioAnio)
      .order('fecha_esperada'),
  ])

  // ── Tab Ingresos ──────────────────────────────────────────
  const ingresos: FilaIngreso[] = (facturasRaw ?? []).map((f: any) => ({
    id:                 f.id,
    serie_numero:       f.serie_numero,
    nombre_contraparte: f.nombre_contraparte ?? null,
    proyecto_nombre:    f.proyecto?.nombre ?? null,
    total:              f.total,
    fecha_emision:      f.fecha_emision,
    fecha_pago:         f.fecha_pago ?? null,
    estado:             f.estado,
  }))

  // ── Tab Egresos ───────────────────────────────────────────
  const egresos: FilaEgreso[] = (costosRaw ?? []).map((c: any) => ({
    id:              c.id,
    descripcion:     c.descripcion,
    proyecto_nombre: c.proyecto?.nombre ?? null,
    centro_costo:    c.centro_costo ?? 'otros',
    categoria:       c.categoria,
    medio_pago:      c.medio_pago ?? 'efectivo',
    monto:           c.monto,
    fecha:           c.fecha,
    comprobante:     c.comprobante ?? null,
  }))

  // ── Estado de resultados por mes ──────────────────────────
  const mesMap: Record<string, { ingresos: number; egresos: number }> = {}
  for (const f of facturasRaw ?? []) {
    const mes = f.fecha_emision.slice(0, 7)
    if (!mesMap[mes]) mesMap[mes] = { ingresos: 0, egresos: 0 }
    mesMap[mes].ingresos += f.total
  }
  for (const c of costosRaw ?? []) {
    const mes = c.fecha.slice(0, 7)
    if (!mesMap[mes]) mesMap[mes] = { ingresos: 0, egresos: 0 }
    mesMap[mes].egresos += c.monto
  }
  const estadoResultados: FilaEstadoResultados[] = Object.entries(mesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v, utilidad: v.ingresos - v.egresos }))

  // ── Cuentas por cobrar ────────────────────────────────────
  const cuentasCobrar: FilaCuentaCobrar[] = (facturasXCobrar ?? []).map((f: any) => {
    const vence    = f.fecha_vencimiento ? new Date(f.fecha_vencimiento) : null
    const diasVenc = vence ? Math.floor((hoy.getTime() - vence.getTime()) / 86400000) : -999
    return {
      id:                 f.id,
      serie_numero:       f.serie_numero,
      nombre_contraparte: f.nombre_contraparte ?? null,
      proyecto_nombre:    f.proyecto?.nombre ?? null,
      total:              f.total,
      fecha_emision:      f.fecha_emision,
      fecha_vencimiento:  f.fecha_vencimiento ?? null,
      dias_vencida:       diasVenc,
      estado:             f.estado,
    }
  })

  // ── Financiero por obra ───────────────────────────────────
  const obraMap: Record<string, FilaObraFinanciero> = {}
  for (const p of proyectos ?? []) {
    obraMap[p.id] = {
      proyecto_id: p.id, proyecto_codigo: p.codigo, proyecto_nombre: p.nombre,
      cliente: p.cliente, presupuesto_contrato: p.presupuesto_contrato,
      ingresos: 0, egresos: 0, utilidad: 0, margen: 0, egresos_categoria: [],
    }
  }
  for (const f of facturasRaw ?? []) {
    if (f.proyecto_id && obraMap[f.proyecto_id]) obraMap[f.proyecto_id].ingresos += f.total
  }
  const catMap: Record<string, Record<string, CategoriaEgreso>> = {}
  for (const c of costosRaw ?? []) {
    if (!c.proyecto_id) continue
    if (!obraMap[c.proyecto_id]) {
      obraMap[c.proyecto_id] = {
        proyecto_id: c.proyecto_id, proyecto_codigo: (c.proyecto as any)?.codigo ?? '—',
        proyecto_nombre: (c.proyecto as any)?.nombre ?? 'Sin proyecto',
        cliente: 'Interno', presupuesto_contrato: 0,
        ingresos: 0, egresos: 0, utilidad: 0, margen: 0, egresos_categoria: [],
      }
    }
    obraMap[c.proyecto_id].egresos += c.monto
    if (!catMap[c.proyecto_id]) catMap[c.proyecto_id] = {}
    if (!catMap[c.proyecto_id][c.categoria]) catMap[c.proyecto_id][c.categoria] = { categoria: c.categoria, total: 0, cantidad: 0 }
    catMap[c.proyecto_id][c.categoria].total    += c.monto
    catMap[c.proyecto_id][c.categoria].cantidad += 1
  }
  for (const obra of Object.values(obraMap)) {
    obra.utilidad          = obra.ingresos - obra.egresos
    obra.margen            = obra.ingresos > 0 ? Math.round(obra.utilidad / obra.ingresos * 1000) / 10 : 0
    obra.egresos_categoria = Object.values(catMap[obra.proyecto_id] ?? {}).sort((a, b) => b.total - a.total)
  }
  const obraFinanciero = Object.values(obraMap)
    .filter(o => o.ingresos > 0 || o.egresos > 0)
    .sort((a, b) => a.proyecto_codigo.localeCompare(b.proyecto_codigo))

  // ── Flujo proyectado (próximos 90d) ───────────────────────
  const fecha30   = new Date(hoy.getTime() + 30 * 86400000).toISOString().split('T')[0]
  const fecha60   = new Date(hoy.getTime() + 60 * 86400000).toISOString().split('T')[0]
  const allFlujo: FilaFlujo[] = (flujoProyectadoRaw ?? [])
    .filter((f: any) => !f.realizado && f.fecha_esperada >= isoHoy)
    .map((f: any) => ({
      id: f.id, tipo: f.tipo, descripcion: f.descripcion,
      monto: f.monto, fecha_esperada: f.fecha_esperada, origen: f.origen ?? null,
    }))
  const flujo30 = allFlujo.filter(f => f.fecha_esperada <= fecha30)
  const flujo60 = allFlujo.filter(f => f.fecha_esperada <= fecha60)
  const flujo90 = allFlujo

  // ── Flujo real vs proyectado por mes ──────────────────────
  const flujoMesMap: Record<string, FilaFlujoMes> = {}
  const ensureMes = (mes: string) => {
    if (!flujoMesMap[mes]) flujoMesMap[mes] = {
      mes, ingresos_real: 0, egresos_real: 0,
      cobros_proyectado: 0, pagos_proyectado: 0,
      flujo_real: 0, flujo_proyectado: 0,
    }
  }
  for (const f of facturasRaw ?? []) {
    const mes = f.fecha_emision.slice(0, 7)
    ensureMes(mes)
    flujoMesMap[mes].ingresos_real += f.total
  }
  for (const c of costosRaw ?? []) {
    const mes = c.fecha.slice(0, 7)
    ensureMes(mes)
    flujoMesMap[mes].egresos_real += c.monto
  }
  for (const f of flujoProyectadoRaw ?? []) {
    const mes = f.fecha_esperada.slice(0, 7)
    if (mes < inicioAnio.slice(0, 7)) continue
    ensureMes(mes)
    if (f.tipo === 'cobro') flujoMesMap[mes].cobros_proyectado += f.monto
    else                    flujoMesMap[mes].pagos_proyectado  += f.monto
  }
  const flujoMes = Object.values(flujoMesMap)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(m => ({
      ...m,
      flujo_real:      m.ingresos_real - m.egresos_real,
      flujo_proyectado: m.cobros_proyectado - m.pagos_proyectado,
    }))

  // ── Resumen ejecutivo ─────────────────────────────────────
  const costosPorProyecto: Record<string, number> = {}
  for (const c of costosRaw ?? []) {
    if (!c.proyecto_id) continue
    costosPorProyecto[c.proyecto_id] = (costosPorProyecto[c.proyecto_id] ?? 0) + c.monto
  }
  const resumenObras: FilaResumenObra[] = (proyectos ?? []).map((p: any) => {
    const ejecutado = costosPorProyecto[p.id] ?? 0
    const margen    = p.presupuesto_contrato > 0
      ? ((p.presupuesto_contrato - ejecutado) / p.presupuesto_contrato) * 100 : 0
    return {
      id: p.id, codigo: p.codigo, nombre: p.nombre, cliente: p.cliente,
      presupuesto_contrato: p.presupuesto_contrato, costo_ejecutado: ejecutado,
      margen: Math.round(margen * 10) / 10, avance_fisico: p.avance_fisico ?? 0, estado: p.estado,
    }
  })

  // ── Totales resumen ───────────────────────────────────────
  const totalPorCobrar   = cuentasCobrar.reduce((s, f) => s + f.total, 0)
  const totalVencido     = cuentasCobrar.filter(f => f.dias_vencida > 0).reduce((s, f) => s + f.total, 0)
  const totalCostosMes   = (costosRaw ?? []).filter((c: any) => c.fecha >= inicioMes).reduce((s: number, c: any) => s + c.monto, 0)
  const totalIngresosMes = (facturasRaw ?? []).filter((f: any) => f.fecha_emision >= inicioMes).reduce((s: number, f: any) => s + f.total, 0)

  return {
    estadoResultados, ingresos, egresos, cuentasCobrar, obraFinanciero,
    flujo30, flujo60, flujo90, flujoMes, resumenObras,
    totalPorCobrar, totalVencido, totalCostosMes, totalIngresosMes,
  }
}
