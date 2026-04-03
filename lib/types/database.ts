export type Rol = 'gerente' | 'contador' | 'ingeniero' | 'almacenero' | 'admin'
export type EstadoProyecto = 'activo' | 'pausado' | 'terminado' | 'liquidado'
export type EstadoLicitacion = 'en_evaluacion' | 'presentada' | 'ganada' | 'perdida' | 'desierta'
export type EstadoFactura = 'pendiente' | 'pagada' | 'vencida' | 'anulada'
export type EstadoCertificacion = 'borrador' | 'presentada' | 'aprobada' | 'cobrada'
export type CategoriaEgreso = 'material' | 'subcontrato' | 'mano_obra' | 'alquiler' | 'administracion' | 'impuesto'
export type TipoFlujo = 'cobro' | 'pago'

export interface Empresa {
  id: string
  razon_social: string
  ruc: string
  moneda_base: string
}

export interface Proyecto {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  cliente: string
  tipo: 'publico' | 'privado'
  estado: EstadoProyecto
  presupuesto_contrato: number
  presupuesto_costo: number
  avance_fisico: number
  fecha_inicio: string | null
  fecha_fin_contrato: string | null
}

export interface Factura {
  id: string
  empresa_id: string
  proyecto_id: string | null
  proveedor_id: string | null
  tipo: 'emitida' | 'recibida'
  serie_numero: string
  subtotal: number
  igv: number
  total: number
  estado: EstadoFactura
  fecha_emision: string
  fecha_vencimiento: string | null
}

export interface Certificacion {
  id: string
  proyecto_id: string
  numero: number
  monto: number
  estado: EstadoCertificacion
  fecha: string
}

export interface CostoDirecto {
  id: string
  proyecto_id: string
  categoria: CategoriaEgreso
  descripcion: string
  monto: number
  fecha: string
}

export interface FlujoCajaProyectado {
  id: string
  empresa_id: string
  proyecto_id: string | null
  tipo: TipoFlujo
  descripcion: string
  monto: number
  fecha_esperada: string
  realizado: boolean
}

// ── Dashboard types ──────────────────────────────────────────

export interface KpiDashboard {
  ingresos_mes: number
  egresos_mes: number
  utilidad_mes: number
  flujo_proyectado: number
  variacion_ingresos: number
  variacion_egresos: number
  variacion_utilidad: number
  dso: number
}

export interface KpiDetalleItem {
  label: string
  sub?: string
  monto: number
  estado?: string
  fecha?: string
}

export interface ProyectoResumen {
  id: string
  nombre: string
  cliente: string
  presupuesto_contrato: number
  avance_fisico: number
  margen: number
  estado: EstadoProyecto
  fecha_inicio: string | null
  fecha_fin_contrato: string | null
}

export interface ProyectoRiesgo {
  id: string
  nombre: string
  cliente: string
  avance_fisico: number
  avance_esperado: number
  desviacion: number
  dias_restantes: number
  fecha_fin_contrato: string
}

export interface VencimientoItem {
  id: string
  descripcion: string
  tipo: 'cobro' | 'pago'
  monto: number
  fecha: string
  dias_para_vencer: number
  origen: string
}

export interface EgresoDetalle {
  descripcion: string
  monto: number
  proyecto: string
}

export interface EgresoCategoria {
  categoria: CategoriaEgreso
  total: number
  porcentaje: number
}

export interface SankeyFlow {
  from: string
  to: string
  flow: number
}

export interface AlertaDashboard {
  id: string
  tipo: 'error' | 'warning' | 'info'
  titulo: string
  descripcion: string
  monto?: number
  ruta?: string
}
