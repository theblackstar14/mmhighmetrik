import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

export interface Licitacion {
  id:                  string
  codigo:              string | null
  nombre:              string
  entidad:             string
  tipo:                'publica' | 'privada' | 'internacional'
  modalidad:           string | null
  ubicacion:           string | null
  descripcion:         string | null
  monto_referencial:   number | null
  monto_ofertado:      number | null
  monto_adjudicado:    number | null
  estado:              'evaluando' | 'preparando' | 'presentada' | 'ganada' | 'perdida' | 'desierta' | 'retirada'
  probabilidad:        number
  fecha_publicacion:   string | null
  fecha_presentacion:  string | null
  fecha_resultado:     string | null
  responsable:         string | null
  observaciones:       string | null
  created_at:          string
  // calculados
  dias_restantes:      number | null  // null si no hay fecha o ya pasó
  vencida:             boolean
}

export interface DatosLicitaciones {
  licitaciones: Licitacion[]
  dbExists:     boolean
}

export async function getDatosLicitaciones(): Promise<DatosLicitaciones> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()
  const hoy       = new Date()
  hoy.setHours(0, 0, 0, 0)

  // La tabla usa fecha_convocatoria y fecha_buena_pro (esquema original)
  const { data: raw, error } = await supabase
    .from('licitacion')
    .select('id,codigo,nombre,entidad,tipo,modalidad,ubicacion,descripcion,monto_referencial,monto_ofertado,monto_adjudicado,estado,probabilidad,fecha_convocatoria,fecha_presentacion,fecha_buena_pro,responsable,observaciones,created_at')
    .eq('empresa_id', empresaId)
    .order('fecha_presentacion', { ascending: true, nullsFirst: false })

  const licitaciones: Licitacion[] = (raw ?? []).map((r: any) => {
    let dias_restantes: number | null = null
    let vencida = false
    if (r.fecha_presentacion) {
      const fp = new Date(r.fecha_presentacion + 'T00:00:00')
      const diff = Math.round((fp.getTime() - hoy.getTime()) / 86400000)
      dias_restantes = diff
      vencida = diff < 0
    }
    return {
      id: r.id, codigo: r.codigo ?? null, nombre: r.nombre, entidad: r.entidad,
      tipo: r.tipo, modalidad: r.modalidad ?? null, ubicacion: r.ubicacion ?? null,
      descripcion: r.descripcion ?? null,
      monto_referencial: r.monto_referencial ?? null, monto_ofertado: r.monto_ofertado ?? null,
      monto_adjudicado: r.monto_adjudicado ?? null,
      estado: r.estado, probabilidad: r.probabilidad ?? 50,
      fecha_publicacion: r.fecha_convocatoria ?? null, fecha_presentacion: r.fecha_presentacion ?? null,
      fecha_resultado: r.fecha_buena_pro ?? null,
      responsable: r.responsable ?? null, observaciones: r.observaciones ?? null,
      created_at: r.created_at,
      dias_restantes, vencida,
    }
  })

  // Solo ocultar la UI si la tabla definitivamente no existe
  const tableNotFound = !!error && (
    error.message?.includes('does not exist') ||
    error.message?.includes('relation') ||
    (error as any).code === '42P01' ||
    (error as any).code === 'PGRST204' ||
    (error as any).code === '404'
  )
  return { licitaciones, dbExists: !tableNotFound }
}
