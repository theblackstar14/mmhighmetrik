import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

export interface FacturaRow {
  id: string
  tipo: 'emitida' | 'recibida'
  serie_numero: string
  proyecto_id: string | null
  proyecto_nombre: string | null
  proveedor_id: string | null
  proveedor_nombre: string | null
  ruc_contraparte: string | null
  nombre_contraparte: string | null
  subtotal: number
  igv: number
  total: number
  moneda: string
  tipo_cambio: number | null
  estado: string
  fecha_emision: string
  fecha_vencimiento: string | null
  fecha_pago: string | null
  notas: string | null
}

export interface GastoRow {
  id: string
  proyecto_id: string | null
  proyecto_nombre: string | null
  centro_costo: string        // proyecto | oficina | vehiculos | almacen | personal | otros
  categoria: string
  descripcion: string
  referencia: string | null   // texto libre: "Excavadora CAT 320", "Camión Placa XYZ", etc.
  medio_pago: string          // efectivo | transferencia | cheque | tarjeta
  monto: number
  fecha: string
  registrado_por: string | null
  comprobante: string | null
}

export interface ProyectoOpcion {
  id: string
  codigo: string
  nombre: string
}

export interface ProveedorOpcion {
  id: string
  razon_social: string
  ruc: string
}

export interface KpisFacturacion {
  por_cobrar: number
  vencidas_cobro: number
  por_pagar: number
  vencidas_pago: number
  cobrado_mes: number
  pagado_mes: number
  gastado_mes: number
}

export interface DatosFacturacion {
  emitidas: FacturaRow[]
  recibidas: FacturaRow[]
  gastos: GastoRow[]
  proyectos: ProyectoOpcion[]
  proveedores: ProveedorOpcion[]
  kpis: KpisFacturacion
}

export async function getDatosFacturacion(): Promise<DatosFacturacion> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()

  const hoy    = new Date()
  const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: facturasRaw },
    { data: costosRaw },
    { data: proyectosRaw },
    { data: proveedoresRaw },
  ] = await Promise.all([
    supabase
      .from('factura')
      .select(`
        id, tipo, serie_numero, proyecto_id, proveedor_id,
        ruc_contraparte, nombre_contraparte,
        subtotal, igv, total, moneda, tipo_cambio,
        estado, fecha_emision, fecha_vencimiento, fecha_pago, notas,
        proyecto:proyecto_id ( nombre ),
        proveedor:proveedor_id ( razon_social )
      `)
      .eq('empresa_id', empresaId)
      .order('fecha_emision', { ascending: false }),

    supabase
      .from('costo_directo')
      .select(`
        id, proyecto_id, centro_costo, categoria, descripcion, referencia,
        medio_pago, monto, fecha, registrado_por, comprobante,
        proyecto:proyecto_id ( nombre )
      `)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false }),

    supabase
      .from('proyecto')
      .select('id, codigo, nombre')
      .eq('empresa_id', empresaId)
      .in('estado', ['activo', 'pausado'])
      .order('codigo'),

    supabase
      .from('proveedor')
      .select('id, razon_social, ruc')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('razon_social'),
  ])

  // Normalizar facturas
  const facturas: FacturaRow[] = (facturasRaw ?? []).map((f: any) => ({
    id:                  f.id,
    tipo:                f.tipo,
    serie_numero:        f.serie_numero,
    proyecto_id:         f.proyecto_id,
    proyecto_nombre:     f.proyecto?.nombre ?? null,
    proveedor_id:        f.proveedor_id,
    proveedor_nombre:    f.proveedor?.razon_social ?? null,
    ruc_contraparte:     f.ruc_contraparte ?? null,
    nombre_contraparte:  f.nombre_contraparte ?? null,
    subtotal:            f.subtotal,
    igv:                 f.igv,
    total:               f.total,
    moneda:              f.moneda ?? 'PEN',
    tipo_cambio:         f.tipo_cambio ?? null,
    estado:              f.estado,
    fecha_emision:       f.fecha_emision,
    fecha_vencimiento:   f.fecha_vencimiento ?? null,
    fecha_pago:          f.fecha_pago ?? null,
    notas:               f.notas ?? null,
  }))

  // Normalizar gastos
  const gastos: GastoRow[] = (costosRaw ?? []).map((c: any) => ({
    id:              c.id,
    proyecto_id:     c.proyecto_id     ?? null,
    proyecto_nombre: c.proyecto?.nombre ?? null,
    centro_costo:    c.centro_costo    ?? 'proyecto',
    categoria:       c.categoria,
    descripcion:     c.descripcion,
    referencia:      c.referencia      ?? null,
    medio_pago:      c.medio_pago      ?? 'efectivo',
    monto:           c.monto,
    fecha:           c.fecha,
    registrado_por:  c.registrado_por  ?? null,
    comprobante:     c.comprobante     ?? null,
  }))

  const emitidas  = facturas.filter(f => f.tipo === 'emitida')
  const recibidas = facturas.filter(f => f.tipo === 'recibida')

  const kpis: KpisFacturacion = {
    por_cobrar:     emitidas.filter(f => ['pendiente','vencida'].includes(f.estado)).reduce((s, f) => s + f.total, 0),
    vencidas_cobro: emitidas.filter(f => f.estado === 'vencida').length,
    por_pagar:      recibidas.filter(f => ['pendiente','vencida'].includes(f.estado)).reduce((s, f) => s + f.total, 0),
    vencidas_pago:  recibidas.filter(f => f.estado === 'vencida').length,
    cobrado_mes:    emitidas.filter(f => f.estado === 'pagada' && f.fecha_pago && f.fecha_pago >= iniMes && f.fecha_pago <= finMes).reduce((s, f) => s + f.total, 0),
    pagado_mes:     recibidas.filter(f => f.estado === 'pagada' && f.fecha_pago && f.fecha_pago >= iniMes && f.fecha_pago <= finMes).reduce((s, f) => s + f.total, 0),
    gastado_mes:    gastos.filter(g => g.fecha >= iniMes && g.fecha <= finMes).reduce((s, g) => s + g.monto, 0),
  }

  return {
    emitidas,
    recibidas,
    gastos,
    proyectos:   (proyectosRaw  ?? []) as ProyectoOpcion[],
    proveedores: (proveedoresRaw ?? []) as ProveedorOpcion[],
    kpis,
  }
}
