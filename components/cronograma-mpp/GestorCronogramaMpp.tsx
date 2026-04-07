'use client'
import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

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

interface CronogramaMpp {
  id: string
  nombre: string
  empresa_id: string
  tareas: Tarea[]
  created_at: string
}

interface Props {
  cronogramas: CronogramaMpp[]
  empresaId: string
  dbExists: boolean
}

const SQL_CRONOGRAMA_MPP = `
CREATE TABLE cronograma_mpp (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  tareas      jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cronograma_mpp ENABLE ROW LEVEL SECURITY;
CREATE POLICY cronograma_mpp_empresa ON cronograma_mpp
  USING (empresa_id = get_empresa_id());
`.trim()

const ROW_H = 24

// ── Gantt colapsable estilo MS Project ───────────────────────────────────────
// ── Panel lateral de detalle ─────────────────────────────────────────────────
function PanelDetalle({ tarea, onClose }: { tarea: Tarea; onClose: () => void }) {
  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.15)',
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, zIndex: 50,
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', background: tarea.es_resumen ? '#1E293B' : '#1D4ED8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>
              {tarea.wbs} · {tarea.es_resumen ? 'Grupo' : 'Tarea'}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{tarea.nombre}</div>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Inicio', valor: tarea.inicio ?? '—' },
              { label: 'Fin',    valor: tarea.fin    ?? '—' },
            ].map(f => (
              <div key={f.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginTop: 3 }}>{f.valor}</div>
              </div>
            ))}
          </div>

          {/* Duraciones */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Dur. Calendarios', valor: tarea.dias_cal > 0 ? `${tarea.dias_cal} días` : '—' },
              { label: 'Dur. Laborables',  valor: tarea.dias_lab > 0 ? `${tarea.dias_lab} days` : '—' },
            ].map(f => (
              <div key={f.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginTop: 3 }}>{f.valor}</div>
              </div>
            ))}
          </div>

          {/* Costo */}
          {tarea.costo != null && (
            <div style={{ background: '#ECFDF5', borderRadius: 8, padding: '12px 14px', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 10, color: '#059669', textTransform: 'uppercase', letterSpacing: 1 }}>Parcial</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#065F46', marginTop: 4 }}>
                S/ {tarea.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}

          {/* Predecesores */}
          {tarea.predecesores && (
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Predecesores</div>
              <div style={{ fontSize: 12, color: '#475569', background: '#F8FAFC', borderRadius: 6, padding: '8px 10px' }}>
                {tarea.predecesores}
              </div>
            </div>
          )}

          {/* Recursos */}
          {tarea.recursos && (
            <div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Resource Names</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tarea.recursos.split(',').map(r => r.trim()).filter(Boolean).map(r => (
                  <span key={r} style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500 }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Tooltip hover ─────────────────────────────────────────────────────────────
function TooltipBarra({ tarea, x, y }: { tarea: Tarea; x: number; y: number }) {
  return (
    <div style={{
      position: 'fixed', left: x + 12, top: y - 10, zIndex: 60,
      background: '#1E293B', color: '#fff', borderRadius: 8,
      padding: '8px 12px', fontSize: 11, pointerEvents: 'none',
      boxShadow: '0 4px 16px rgba(0,0,0,.25)', maxWidth: 220,
      lineHeight: 1.6,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{tarea.nombre}</div>
      {tarea.dias_cal > 0 && <div style={{ color: '#94A3B8' }}>Duración: <b style={{ color: '#fff' }}>{tarea.dias_cal} días</b></div>}
      {tarea.costo != null && <div style={{ color: '#94A3B8' }}>Costo: <b style={{ color: '#6EE7B7' }}>S/ {tarea.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</b></div>}
      {tarea.inicio && <div style={{ color: '#94A3B8' }}>{tarea.inicio} → {tarea.fin}</div>}
      <div style={{ color: '#64748B', fontSize: 10, marginTop: 3 }}>Click para más detalle</div>
    </div>
  )
}

function GanttColapsable({ tareas }: { tareas: Tarea[] }) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda]   = useState('')
  const [nivelMax, setNivelMax]   = useState(99)
  const [panelTarea, setPanelTarea] = useState<Tarea | null>(null)
  const [tooltip, setTooltip]       = useState<{ tarea: Tarea; x: number; y: number } | null>(null)

  const conFechas = tareas.filter(t => t.inicio && t.fin)
  const fechas    = conFechas.flatMap(t => [new Date(t.inicio!), new Date(t.fin!)])
  const minDate   = fechas.length ? new Date(Math.min(...fechas.map(d => d.getTime()))) : new Date()
  const maxDate   = fechas.length ? new Date(Math.max(...fechas.map(d => d.getTime()))) : new Date()
  const totalMs   = Math.max(maxDate.getTime() - minDate.getTime(), 1)

  // Semanas para sub-cabecera
  const semanas = useMemo(() => {
    const arr: { label: string; left: number; width: number }[] = []
    const cur = new Date(minDate)
    cur.setDate(cur.getDate() - cur.getDay() + 1) // lunes
    while (cur <= maxDate) {
      const ini = Math.max(cur.getTime(), minDate.getTime())
      const finSem = new Date(cur); finSem.setDate(finSem.getDate() + 6)
      const fin = Math.min(finSem.getTime(), maxDate.getTime())
      arr.push({
        label: cur.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
        left:  (ini - minDate.getTime()) / totalMs * 100,
        width: Math.max((fin - ini) / totalMs * 100, 0),
      })
      cur.setDate(cur.getDate() + 7)
    }
    return arr
  }, [minDate.getTime(), maxDate.getTime()])

  // Meses para cabecera principal
  const meses = useMemo(() => {
    const arr: { label: string; left: number; width: number }[] = []
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (cur <= maxDate) {
      const ini = Math.max(cur.getTime(), minDate.getTime())
      const fin = Math.min(new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getTime(), maxDate.getTime())
      arr.push({
        label: cur.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
        left:  (ini - minDate.getTime()) / totalMs * 100,
        width: (fin - ini) / totalMs * 100,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return arr
  }, [minDate.getTime(), maxDate.getTime()])

  // Tareas visibles
  const visibles = useMemo(() => {
    const result: Tarea[] = []
    const collapsedStack: number[] = []
    for (const t of tareas) {
      while (collapsedStack.length > 0) {
        const last = tareas.find(x => x.id === collapsedStack[collapsedStack.length - 1])
        if (!last || t.nivel <= last.nivel) collapsedStack.pop()
        else break
      }
      if (collapsedStack.length > 0) {
        if (t.es_resumen) collapsedStack.push(t.id)
        continue
      }
      if (t.nivel > nivelMax) continue
      if (busqueda && !t.nombre.toLowerCase().includes(busqueda.toLowerCase())) {
        if (t.es_resumen) collapsedStack.push(t.id)
        continue
      }
      result.push(t)
      if (t.es_resumen && collapsed.has(t.id)) collapsedStack.push(t.id)
    }
    return result
  }, [tareas, collapsed, busqueda, nivelMax])

  function toggleCollapse(id: number) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const TABLE_W = 520 // ancho parte izquierda (tabla)

  return (
    <div>
      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Buscar tarea..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, width: 180 }} />
        <select value={nivelMax} onChange={e => setNivelMax(Number(e.target.value))}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}>
          <option value={99}>Todos los niveles</option>
          <option value={1}>Nivel 1</option>
          <option value={2}>Hasta nivel 2</option>
          <option value={3}>Hasta nivel 3</option>
          <option value={4}>Hasta nivel 4</option>
        </select>
        <button onClick={() => setCollapsed(new Set())}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 11, cursor: 'pointer' }}>
          ▼ Expandir todo
        </button>
        <button onClick={() => setCollapsed(new Set(tareas.filter(t => t.es_resumen).map(t => t.id)))}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 11, cursor: 'pointer' }}>
          ▶ Colapsar todo
        </button>
        <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>{visibles.length} / {tareas.length} tareas</span>
      </div>

      {/* ── Gantt split ── */}
      <div style={{ display: 'flex', overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>

        {/* Columna izquierda — tabla fija */}
        <div style={{ flexShrink: 0, width: TABLE_W, borderRight: '2px solid #CBD5E1' }}>
          {/* Cabecera tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 70px 80px 80px', background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
            {['Item', 'Nombre de tarea', 'Dur.', 'Inicio', 'Fin'].map(h => (
              <div key={h} style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#475569', borderRight: '1px solid #E2E8F0' }}>{h}</div>
            ))}
          </div>
          {/* Filas tabla */}
          {visibles.map(t => (
            <div key={t.id} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 70px 80px 80px',
              height: ROW_H, borderBottom: '1px solid #F1F5F9',
              background: t.es_resumen ? '#F8FAFC' : '#fff',
            }}>
              <div style={{ padding: '0 8px', fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', borderRight: '1px solid #F1F5F9', overflow: 'hidden' }}>
                {t.wbs}
              </div>
              <div
                onClick={() => t.es_resumen && toggleCollapse(t.id)}
                title={t.nombre}
                style={{
                  padding: '0 6px', display: 'flex', alignItems: 'center', gap: 4,
                  paddingLeft: 6 + t.nivel * 10,
                  fontSize: 11, fontWeight: t.es_resumen ? 700 : 400,
                  color: t.es_resumen ? '#0F172A' : '#334155',
                  cursor: t.es_resumen ? 'pointer' : 'default',
                  overflow: 'hidden', borderRight: '1px solid #F1F5F9',
                  userSelect: 'none',
                }}
              >
                {t.es_resumen && <span style={{ fontSize: 8, flexShrink: 0 }}>{collapsed.has(t.id) ? '▶' : '▼'}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
              </div>
              <div style={{ padding: '0 6px', fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', borderRight: '1px solid #F1F5F9' }}>
                {t.dias_cal > 0 ? `${t.dias_cal}d` : '—'}
              </div>
              <div style={{ padding: '0 6px', fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', borderRight: '1px solid #F1F5F9' }}>
                {t.inicio ?? '—'}
              </div>
              <div style={{ padding: '0 6px', fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center' }}>
                {t.fin ?? '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Columna derecha — barras de Gantt */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 600 }}>
          {/* Cabecera meses */}
          <div style={{ position: 'relative', height: 20, background: '#1E293B', borderBottom: '1px solid #334155' }}>
            {meses.map((m, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${m.left}%`, width: `${m.width}%`,
                height: '100%', borderLeft: '1px solid #334155',
                fontSize: 10, color: '#CBD5E1', fontWeight: 700,
                display: 'flex', alignItems: 'center', paddingLeft: 4,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>{m.label}</div>
            ))}
          </div>
          {/* Cabecera semanas */}
          <div style={{ position: 'relative', height: 18, background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
            {semanas.map((s, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${s.left}%`, width: `${s.width}%`,
                height: '100%', borderLeft: '1px solid #E2E8F0',
                fontSize: 9, color: '#94A3B8',
                display: 'flex', alignItems: 'center', paddingLeft: 2,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>{s.label}</div>
            ))}
          </div>
          {/* Filas barras */}
          {visibles.map(t => {
            const left  = t.inicio ? (new Date(t.inicio).getTime() - minDate.getTime()) / totalMs * 100 : null
            const width = (t.inicio && t.fin)
              ? Math.max((new Date(t.fin).getTime() - new Date(t.inicio).getTime()) / totalMs * 100, 0.2)
              : null
            return (
              <div key={t.id} style={{
                position: 'relative', height: ROW_H,
                borderBottom: '1px solid #F1F5F9',
                background: t.es_resumen ? '#F8FAFC' : '#fff',
              }}>
                {/* Líneas de cuadrícula verticales (semanas) */}
                {semanas.map((s, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: `${s.left}%`, top: 0, bottom: 0,
                    width: 1, background: '#F1F5F9',
                  }} />
                ))}
                {/* Barra */}
                {left !== null && width !== null && (
                  <div
                    onClick={() => setPanelTarea(t)}
                    onMouseMove={e => setTooltip({ tarea: t, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: t.es_resumen ? 7 : 8,
                      height: t.es_resumen ? 10 : 8,
                      background: t.es_resumen ? '#1E293B' : '#3B82F6',
                      borderRadius: t.es_resumen ? 2 : 4,
                      minWidth: 3,
                      cursor: 'pointer',
                      transition: 'filter .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.25)')}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {visibles.length === 0 && (
        <div style={{ color: '#94A3B8', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
          Sin resultados para los filtros aplicados
        </div>
      )}

      {/* Panel lateral */}
      {panelTarea && <PanelDetalle tarea={panelTarea} onClose={() => setPanelTarea(null)} />}

      {/* Tooltip hover */}
      {tooltip && <TooltipBarra tarea={tooltip.tarea} x={tooltip.x} y={tooltip.y} />}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GestorCronogramaMpp({ cronogramas: inicial, empresaId, dbExists }: Props) {
  const [cronogramas, setCronogramas] = useState(inicial)
  const [seleccionado, setSeleccionado] = useState<CronogramaMpp | null>(inicial[0] ?? null)
  const [uploading, setUploading]       = useState(false)
  const [progreso, setProgreso]         = useState('')
  const [error, setError]               = useState('')
  const [dragging, setDragging]         = useState(false)
  const [tab, setTab]                   = useState<'gantt'|'lista'>('gantt')
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function procesarArchivo(file: File) {
    if (!file.name.toLowerCase().endsWith('.mpp')) {
      setError('Solo se aceptan archivos .mpp')
      return
    }
    setUploading(true)
    setError('')
    setProgreso('Subiendo y convirtiendo archivo...')

    try {
      const fd = new FormData()
      fd.append('file', file)
      const convRes = await fetch('/api/mpp-convert', { method: 'POST', body: fd })
      const convData = await convRes.json()
      if (!convRes.ok) throw new Error(convData.error ?? 'Error en conversión')

      setProgreso(`Guardando ${convData.tareas.length} tareas...`)

      const nombre = file.name.replace(/\.mpp$/i, '')
      const { data, error: dbErr } = await supabase
        .from('cronograma_mpp')
        .insert({ empresa_id: empresaId, nombre, archivo: file.name, tareas: convData.tareas })
        .select()
        .single()

      if (dbErr) throw new Error(dbErr.message)

      if (convData.total && convData.total > convData.tareas.length) {
        setProgreso(`Nota: se cargaron ${convData.tareas.length} de ${convData.total} tareas (límite de la API)`)
        setTimeout(() => setProgreso(''), 5000)
      } else {
        setProgreso('')
      }

      setCronogramas(prev => [data, ...prev])
      setSeleccionado(data)
    } catch (e: any) {
      setError(e.message)
      setProgreso('')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  async function eliminar(id: string) {
    await supabase.from('cronograma_mpp').delete().eq('id', id)
    const resto = cronogramas.filter(c => c.id !== id)
    setCronogramas(resto)
    setSeleccionado(resto[0] ?? null)
  }

  if (!dbExists) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #E2E8F0', maxWidth: 600 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>Tabla requerida: cronograma_mpp</div>
          <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, fontSize: 12, color: '#334155', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {SQL_CRONOGRAMA_MPP}
          </pre>
        </div>
      </div>
    )
  }

  const tareas: Tarea[] = seleccionado?.tareas ?? []
  const sinResumen      = tareas.filter(t => !t.es_resumen)
  const totalTareas     = sinResumen.length
  const completadas     = sinResumen.filter(t => t.avance >= 100).length
  const enCurso         = sinResumen.filter(t => t.avance > 0 && t.avance < 100).length
  const avanceGlobal    = totalTareas > 0
    ? Math.round(sinResumen.reduce((s, t) => s + t.avance, 0) / totalTareas)
    : 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 260, flexShrink: 0, background: '#fff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Cronogramas MPP</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{cronogramas.length} archivos</div>
        </div>

        <div style={{ padding: '12px 12px 8px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#3B82F6' : '#CBD5E1'}`,
              borderRadius: 10, padding: '16px 12px', textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: dragging ? '#EFF6FF' : '#F8FAFC', transition: 'all .2s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{uploading ? '⏳' : '📁'}</div>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
              {uploading ? 'Procesando...' : 'Arrastra tu .mpp aquí'}
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
              {uploading ? progreso : 'o haz click para seleccionar'}
            </div>
            <input ref={inputRef} type="file" accept=".mpp" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f) }} />
          </div>
          {error    && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>{error}</div>}
          {progreso && !uploading && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 6 }}>{progreso}</div>}
        </div>

        <div style={{ flex: 1, padding: '0 8px 16px' }}>
          {cronogramas.length === 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Sin cronogramas</div>
          )}
          {cronogramas.map(c => (
            <div key={c.id} onClick={() => setSeleccionado(c)} style={{
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
              background: seleccionado?.id === c.id ? '#EFF6FF' : 'transparent',
              border: seleccionado?.id === c.id ? '1px solid #BFDBFE' : '1px solid transparent',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 2 }}>{c.nombre}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>
                {new Date(c.created_at).toLocaleDateString('es-PE')} · {(c.tareas as Tarea[]).length} tareas
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Detalle ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {!seleccionado ? (
          <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 60, textAlign: 'center' }}>
            Sube un archivo .mpp para comenzar
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{seleccionado.nombre}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>
                  Subido el {new Date(seleccionado.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => eliminar(seleccionado.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total tareas',  valor: totalTareas,        color: '#1E293B' },
                { label: 'Completadas',   valor: completadas,        color: '#22C55E' },
                { label: 'En curso',      valor: enCurso,            color: '#3B82F6' },
                { label: 'Avance global', valor: `${avanceGlobal}%`, color: '#F59E0B' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.valor}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E2E8F0' }}>
              {(['gantt', 'lista'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === t ? 700 : 400,
                  color: tab === t ? '#1E293B' : '#94A3B8',
                  borderBottom: tab === t ? '2px solid #1E293B' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                  {t === 'gantt' ? 'Diagrama de Gantt' : 'Lista de tareas'}
                </button>
              ))}
            </div>

            {tab === 'gantt' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
                <GanttColapsable tareas={tareas} />
              </div>
            )}

            {tab === 'lista' && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Item','Nombre de tarea','Dur. Cal.','Start','Finish','Dur. Lab.','Predecesores','Parcial','Resource Names','Avance'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tareas.map((t, i) => (
                        <tr key={t.id} style={{ borderTop: '1px solid #F1F5F9', background: t.es_resumen ? '#F8FAFC' : '#fff' }}>
                          <td style={{ padding: '6px 12px', color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap' }}>{t.wbs || i + 1}</td>
                          <td style={{ padding: '6px 12px', color: '#1E293B', fontWeight: t.es_resumen ? 700 : 400, paddingLeft: 12 + t.nivel * 12, minWidth: 200 }}>{t.nombre}</td>
                          <td style={{ padding: '6px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{t.dias_cal > 0 ? `${t.dias_cal} días` : '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{t.inicio ?? '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{t.fin ?? '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{t.dias_lab > 0 ? `${t.dias_lab} days` : '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#64748B', fontSize: 11 }}>{t.predecesores || '—'}</td>
                          <td style={{ padding: '6px 12px', color: '#1E293B', whiteSpace: 'nowrap', fontWeight: t.es_resumen ? 700 : 400 }}>
                            {t.costo != null ? `S/ ${t.costo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td style={{ padding: '6px 12px', color: '#475569', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.recursos || '—'}</td>
                          <td style={{ padding: '6px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 50, height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${t.avance}%`, height: '100%', background: t.avance >= 100 ? '#22C55E' : '#3B82F6', borderRadius: 3 }} />
                              </div>
                              <span style={{ color: '#64748B', fontSize: 11 }}>{t.avance}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
