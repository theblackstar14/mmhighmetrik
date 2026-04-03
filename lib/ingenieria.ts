import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/empresa'

// ── Proyecto con métricas de avance ───────────────────────────
export interface ProyectoIng {
  id:                  string
  codigo:              string
  nombre:              string
  cliente:             string
  estado:              string
  avance_fisico:       number
  avance_esperado:     number
  desvio:              number
  fecha_inicio:        string | null
  fecha_fin_contrato:  string | null
  dias_restantes:      number
  atrasado:            boolean
  nivel_riesgo:        'ok' | 'medio' | 'alto' | 'critico'
  presupuesto_costo:   number
  costo_total:         number
  costo_material:      number
  costo_mano_obra:     number
  costo_subcontrato:   number
  costo_alquiler:      number
  costo_admin:         number
}

// ── Partida (ítem de presupuesto técnico) ─────────────────────
export interface PartidaIng {
  id:               string
  proyecto_id:      string
  proyecto_codigo:  string
  proyecto_nombre:  string
  codigo:           string
  descripcion:      string
  unidad:           string
  metrado:          number
  precio_unitario:  number
  total:            number
  avance_fisico:    number
  fecha_inicio:     string | null
  fecha_fin:        string | null
  responsable:      string | null
}

// ── Orden de trabajo ──────────────────────────────────────────
export interface OrdenTrabajo {
  id:                string
  proyecto_id:       string | null
  proyecto_nombre:   string | null
  numero:            string
  titulo:            string
  descripcion:       string | null
  tipo:              string
  prioridad:         string
  estado:            string
  responsable:       string | null
  fecha_emision:     string
  fecha_limite:      string | null
  fecha_completada:  string | null
}

export interface DatosIngenieria {
  proyectos:         ProyectoIng[]
  partidas:          PartidaIng[]
  ordenes:           OrdenTrabajo[]
  dbOrdenTrabajo:    boolean
}

export async function getDatosIngenieria(): Promise<DatosIngenieria> {
  const supabase  = await createClient()
  const empresaId = await getEmpresaId()
  const hoy       = new Date()

  // 1. Proyectos activos (sin GG-*)
  const { data: proyRaw } = await supabase
    .from('proyecto')
    .select('id, codigo, nombre, cliente, estado, avance_fisico, presupuesto_costo, fecha_inicio, fecha_fin_contrato')
    .eq('empresa_id', empresaId)
    .in('estado', ['activo', 'pausado'])
    .not('codigo', 'like', 'GG-%')
    .order('codigo')

  const ids = (proyRaw ?? []).map(p => p.id)

  // 2. Partidas + costos + órdenes en paralelo
  const [
    { data: partidasRaw },
    { data: costosRaw },
    { data: ordenesRaw, error: ordenError },
  ] = await Promise.all([
    ids.length > 0
      ? supabase.from('partida')
          .select('id, proyecto_id, codigo, descripcion, unidad, metrado, precio_unitario, total, avance_fisico, fecha_inicio, fecha_fin, responsable')
          .in('proyecto_id', ids)
          .order('codigo')
      : Promise.resolve({ data: [], error: null }),

    ids.length > 0
      ? supabase.from('costo_directo')
          .select('proyecto_id, categoria, monto')
          .in('proyecto_id', ids)
      : Promise.resolve({ data: [], error: null }),

    supabase.from('orden_trabajo')
      .select('id, proyecto_id, numero, titulo, descripcion, tipo, prioridad, estado, responsable, fecha_emision, fecha_limite, fecha_completada, proyecto:proyecto_id(nombre)')
      .eq('empresa_id', empresaId)
      .order('fecha_emision', { ascending: false }),
  ])

  // ── Costos por proyecto y categoría ──────────────────────────
  const costosPorProyecto: Record<string, Record<string, number>> = {}
  for (const c of costosRaw ?? []) {
    if (!c.proyecto_id) continue
    if (!costosPorProyecto[c.proyecto_id]) costosPorProyecto[c.proyecto_id] = {}
    costosPorProyecto[c.proyecto_id][c.categoria] =
      (costosPorProyecto[c.proyecto_id][c.categoria] ?? 0) + c.monto
  }

  const proyMap:       Record<string, string> = {}
  const proyCodigoMap: Record<string, string> = {}

  // ── Proyectos con métricas ────────────────────────────────────
  const proyectos: ProyectoIng[] = (proyRaw ?? []).map(p => {
    proyMap[p.id]       = p.nombre
    proyCodigoMap[p.id] = p.codigo

    const fechaIni = p.fecha_inicio        ? new Date(p.fecha_inicio)        : null
    const fechaFin = p.fecha_fin_contrato  ? new Date(p.fecha_fin_contrato)  : null
    let avanceEsperado = 0, diasRestantes = 0, atrasado = false

    if (fechaIni && fechaFin) {
      const totalDias    = (fechaFin.getTime() - fechaIni.getTime()) / 86400000
      avanceEsperado     = Math.min(100, Math.round(Math.max(0, (hoy.getTime() - fechaIni.getTime()) / 86400000) / totalDias * 100))
      const raw          = Math.round((fechaFin.getTime() - hoy.getTime()) / 86400000)
      atrasado           = raw < 0
      diasRestantes      = Math.abs(raw)
    }

    const desvio = p.avance_fisico - avanceEsperado
    let nivel_riesgo: ProyectoIng['nivel_riesgo'] = 'ok'
    if (atrasado || desvio < -20) nivel_riesgo = 'critico'
    else if (desvio < -10)        nivel_riesgo = 'alto'
    else if (desvio < -5)         nivel_riesgo = 'medio'

    const cats = costosPorProyecto[p.id] ?? {}
    const costo_total = Object.values(cats).reduce((s, v) => s + v, 0)

    return {
      id: p.id, codigo: p.codigo, nombre: p.nombre, cliente: p.cliente, estado: p.estado,
      avance_fisico: p.avance_fisico, avance_esperado: avanceEsperado, desvio,
      fecha_inicio: p.fecha_inicio ?? null, fecha_fin_contrato: p.fecha_fin_contrato ?? null,
      dias_restantes: diasRestantes, atrasado, nivel_riesgo,
      presupuesto_costo: p.presupuesto_costo ?? 0,
      costo_total,
      costo_material:    cats['material']       ?? 0,
      costo_mano_obra:   cats['mano_obra']      ?? 0,
      costo_subcontrato: cats['subcontrato']    ?? 0,
      costo_alquiler:    cats['alquiler']       ?? 0,
      costo_admin:       cats['administracion'] ?? 0,
    }
  })

  // ── Partidas ──────────────────────────────────────────────────
  const partidas: PartidaIng[] = (partidasRaw ?? []).map((pt: any) => ({
    id:               pt.id,
    proyecto_id:      pt.proyecto_id,
    proyecto_codigo:  proyCodigoMap[pt.proyecto_id] ?? '—',
    proyecto_nombre:  proyMap[pt.proyecto_id]       ?? 'Sin proyecto',
    codigo:           pt.codigo,
    descripcion:      pt.descripcion,
    unidad:           pt.unidad,
    metrado:          pt.metrado,
    precio_unitario:  pt.precio_unitario,
    total:            pt.total,
    avance_fisico:    pt.avance_fisico ?? 0,
    fecha_inicio:     pt.fecha_inicio  ?? null,
    fecha_fin:        pt.fecha_fin     ?? null,
    responsable:      pt.responsable   ?? null,
  }))

  // ── Órdenes de trabajo ────────────────────────────────────────
  const ordenes: OrdenTrabajo[] = (ordenesRaw ?? []).map((o: any) => ({
    id:               o.id,
    proyecto_id:      o.proyecto_id      ?? null,
    proyecto_nombre:  o.proyecto?.nombre ?? null,
    numero:           o.numero,
    titulo:           o.titulo,
    descripcion:      o.descripcion      ?? null,
    tipo:             o.tipo             ?? 'trabajo',
    prioridad:        o.prioridad        ?? 'normal',
    estado:           o.estado           ?? 'pendiente',
    responsable:      o.responsable      ?? null,
    fecha_emision:    o.fecha_emision,
    fecha_limite:     o.fecha_limite     ?? null,
    fecha_completada: o.fecha_completada ?? null,
  }))

  return {
    proyectos,
    partidas,
    ordenes,
    dbOrdenTrabajo: !ordenError || !ordenError.message?.includes('does not exist'),
  }
}
