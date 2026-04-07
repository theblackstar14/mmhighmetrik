'use client'
import { useEffect, useRef } from 'react'

interface Tarea {
  id: number
  wbs: string
  nombre: string
  inicio: string | null
  fin: string | null
  avance: number
  dias_cal: number
  dias_lab: number
  predecesores: string
  costo: number | null
  recursos: string
  es_resumen: boolean
  nivel: number
}

interface Props {
  tareas: Tarea[]
}

// Calcula el parent ID de cada tarea desde la lista ordenada
function computeParents(tareas: Tarea[]): Map<number, number> {
  const map = new Map<number, number>()
  const stack: { id: number; nivel: number }[] = []
  for (const t of tareas) {
    while (stack.length > 0 && stack[stack.length - 1].nivel >= t.nivel) stack.pop()
    if (stack.length > 0) map.set(t.id, stack[stack.length - 1].id)
    stack.push({ id: t.id, nivel: t.nivel })
  }
  return map
}

// Parsea predecesores "2, 3FS, 10" → [2, 3, 10]
function parsePreds(str: string): number[] {
  return str.split(',')
    .map(s => parseInt(s.trim().replace(/[^0-9]/g, '')))
    .filter(n => !isNaN(n) && n > 0)
}

export default function GanttDhtmlx({ tareas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttRef     = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || tareas.length === 0) return

    let destroyed = false

    Promise.all([
      import('dhtmlx-gantt'),
      import('dhtmlx-gantt/codebase/dhtmlxgantt.css' as any),
    ]).then(([mod]) => {
      if (destroyed || !containerRef.current) return
      const gantt = mod.gantt ?? (mod as any).default?.gantt ?? (mod as any).default
      ganttRef.current = gantt

      // ── Config ──
      gantt.config.date_format    = '%Y-%m-%d'
      gantt.config.xml_date       = '%Y-%m-%d'
      gantt.config.open_tree_initially = true
      gantt.config.fit_tasks      = true
      gantt.config.scale_height   = 50
      gantt.config.row_height     = 24
      gantt.config.task_height    = 14
      gantt.config.link_arrow_size = 6

      gantt.config.columns = [
        {
          name: 'wbs', label: 'Item', width: 70, align: 'left',
          template: (t: any) => `<span style="color:#94A3B8;font-size:10px">${t.wbs || ''}</span>`,
        },
        { name: 'text', label: 'Nombre de tarea', tree: true, width: 220 },
        {
          name: 'duration', label: 'Dur.', width: 50, align: 'center',
          template: (t: any) => `${t.duration}d`,
        },
        {
          name: 'start_date', label: 'Inicio', width: 82, align: 'center',
          template: (t: any) => gantt.templates.date_grid(t.start_date, t),
        },
        {
          name: 'end_date', label: 'Fin', width: 82, align: 'center',
          template: (t: any) => gantt.templates.date_grid(t.end_date, t),
        },
        {
          name: 'costo', label: 'Parcial', width: 90, align: 'right',
          template: (t: any) => t.costo
            ? `<span style="color:#059669;font-size:10px">S/${Number(t.costo).toLocaleString('es-PE',{minimumFractionDigits:0})}</span>`
            : '',
        },
      ]

      // Escalas: mes + semana
      gantt.config.scales = [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'week',  step: 1, format: 'Sem %W' },
      ]

      // Colores: resumen negro, tareas azul
      gantt.templates.task_class = (_s: any, _e: any, t: any) =>
        t.is_summary ? 'gantt-summary' : 'gantt-task'

      gantt.templates.grid_row_class = (_s: any, _e: any, t: any) =>
        t.is_summary ? 'gantt-row-summary' : ''

      gantt.init(containerRef.current)

      // ── Data ──
      const parents = computeParents(tareas)
      const today   = new Date().toISOString().split('T')[0]

      // Excluir tarea raíz (id=0) — causa ciclo en dhtmlxGantt
      const tareasValidas = tareas.filter(t => t.id !== 0 && t.inicio && t.fin)

      // Remapear IDs para garantizar que empiecen en 1
      const idMap = new Map<number, number>()
      tareasValidas.forEach((t, i) => idMap.set(t.id, i + 1))

      const data = tareasValidas.map(t => {
        const parentOrig = parents.get(t.id)
        const parentNew  = parentOrig !== undefined ? (idMap.get(parentOrig) ?? 0) : 0
        return {
          id:         idMap.get(t.id)!,
          text:       t.nombre,
          start_date: t.inicio!,
          end_date:   t.fin!,
          duration:   t.dias_cal || 1,
          progress:   (t.avance ?? 0) / 100,
          parent:     parentNew,
          open:       t.es_resumen,
          is_summary: t.es_resumen,
          wbs:        t.wbs,
          costo:      t.costo,
          recursos:   t.recursos,
        }
      })

      let linkId = 1
      const links: any[] = []
      tareasValidas.forEach(t => {
        if (!t.predecesores) return
        parsePreds(t.predecesores).forEach(predId => {
          const srcNew = idMap.get(predId)
          const tgtNew = idMap.get(t.id)
          if (srcNew && tgtNew) {
            links.push({ id: linkId++, source: srcNew, target: tgtNew, type: '0' })
          }
        })
      })

      gantt.parse({ data, links })
    })

    return () => {
      destroyed = true
      try { ganttRef.current?.clearAll() } catch {}
    }
  }, [tareas])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        .gantt_task_line.gantt-summary { background: #1E293B !important; border-color: #0F172A !important; }
        .gantt_task_line.gantt-task    { background: #3B82F6 !important; border-color: #1D4ED8 !important; }
        .gantt_row.gantt-row-summary   { background: #F8FAFC !important; font-weight: 700 !important; }
        .gantt_task_link .gantt_line_wrapper div { background: #3B82F6 !important; }
        .gantt_task_link .gantt_link_arrow       { border-color: #3B82F6 !important; }
        .gantt_grid_scale, .gantt_task_scale     { background: #1E293B !important; color: #CBD5E1 !important; }
        .gantt_scale_cell { border-right-color: #334155 !important; }
        .gantt_grid_head_cell { color: #475569 !important; font-size: 11px !important; font-weight: 700 !important; }
        .gantt_cell { font-size: 11px !important; }
        .gantt_tree_content { font-size: 11px !important; }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
