import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

export interface CambioAlcance {
  id:                string
  proyecto_id:       string
  proyecto_codigo:   string
  proyecto_nombre:   string
  tipo:              'adicional' | 'deductivo'
  numero_cambio:     number | null
  descripcion:       string
  monto:             number
  estado:            'solicitado' | 'en_revision' | 'aprobado' | 'rechazado'
  solicitado_por:    string | null
  fecha_solicitud:   string
  fecha_aprobacion:  string | null
  aprobado_por:      string | null
  observaciones:     string | null
}

export interface ProyectoCambio {
  id:                   string
  codigo:               string
  nombre:               string
  presupuesto_contrato: number
}

export interface DatosCambiosAlcance {
  cambios:             CambioAlcance[]
  proyectos:           ProyectoCambio[]
  dbExists:            boolean
}

export async function getDatosCambiosAlcance(): Promise<DatosCambiosAlcance> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()

  const { data: proyRaw } = await supabase
    .from('proyecto')
    .select('id, codigo, nombre, presupuesto_contrato')
    .eq('empresa_id', empresaId)
    .in('estado', ['activo', 'pausado'])
    .not('codigo', 'like', 'GG-%')
    .order('codigo')

  const proyectos: ProyectoCambio[] = (proyRaw ?? []).map(p => ({
    id: p.id, codigo: p.codigo, nombre: p.nombre,
    presupuesto_contrato: p.presupuesto_contrato,
  }))

  const proyMap: Record<string, { codigo: string; nombre: string }> = {}
  for (const p of proyectos) proyMap[p.id] = { codigo: p.codigo, nombre: p.nombre }

  const { data: cambiosRaw, error: cambioError } = await supabase
    .from('cambio_alcance')
    .select('id, proyecto_id, tipo, numero_cambio, descripcion, monto, estado, solicitado_por, fecha_solicitud, fecha_aprobacion, aprobado_por, observaciones')
    .eq('empresa_id', empresaId)
    .order('fecha_solicitud', { ascending: false })

  const cambios: CambioAlcance[] = (cambiosRaw ?? []).map((c: any) => ({
    id:               c.id,
    proyecto_id:      c.proyecto_id,
    proyecto_codigo:  proyMap[c.proyecto_id]?.codigo ?? '—',
    proyecto_nombre:  proyMap[c.proyecto_id]?.nombre ?? 'Sin proyecto',
    tipo:             c.tipo,
    numero_cambio:    c.numero_cambio ?? null,
    descripcion:      c.descripcion,
    monto:            c.monto,
    estado:           c.estado,
    solicitado_por:   c.solicitado_por    ?? null,
    fecha_solicitud:  c.fecha_solicitud,
    fecha_aprobacion: c.fecha_aprobacion  ?? null,
    aprobado_por:     c.aprobado_por      ?? null,
    observaciones:    c.observaciones     ?? null,
  }))

  const tableNotFound = !!cambioError && (
    cambioError.message?.includes('does not exist') ||
    (cambioError as any).code === '42P01'
  )
  return { cambios, proyectos, dbExists: !tableNotFound }
}
