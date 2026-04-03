'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DatosIngenieria, ProyectoIng, PartidaIng, OrdenTrabajo } from '@/lib/ingenieria'

// ── Helpers ───────────────────────────────────────────────────
const fmt    = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) => `${n.toFixed(1)}%`
const fmtFecha = (s: string | null) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Colores riesgo ─────────────────────────────────────────────
const RIESGO: Record<string, { label: string; color: string; bg: string }> = {
  ok:      { label: 'Al día',   color: '#059669', bg: '#ECFDF5' },
  medio:   { label: 'Atención', color: '#B45309', bg: '#FFFBEB' },
  alto:    { label: 'Riesgo',   color: '#EA580C', bg: '#FFF7ED' },
  critico: { label: 'Crítico',  color: '#DC2626', bg: '#FEF2F2' },
}
const CAT_COLOR: Record<string, string> = {
  material: '#2563EB', mano_obra: '#059669', subcontrato: '#7C3AED',
  alquiler: '#D97706', administracion: '#64748B', impuesto: '#DC2626',
}
const CAT_LABEL: Record<string, string> = {
  material: 'Material', mano_obra: 'Mano de obra', subcontrato: 'Subcontrato',
  alquiler: 'Alquiler', administracion: 'Administración', impuesto: 'Impuesto',
}
const PRIORIDAD_COLOR: Record<string, { color: string; bg: string }> = {
  baja:    { color: '#64748B', bg: '#F8FAFC' },
  normal:  { color: '#2563EB', bg: '#EFF6FF' },
  alta:    { color: '#D97706', bg: '#FFFBEB' },
  urgente: { color: '#DC2626', bg: '#FEF2F2' },
}
const ESTADO_OT: Record<string, { color: string; bg: string }> = {
  pendiente:   { color: '#64748B', bg: '#F8FAFC' },
  en_proceso:  { color: '#2563EB', bg: '#EFF6FF' },
  completada:  { color: '#059669', bg: '#ECFDF5' },
  cancelada:   { color: '#9CA3AF', bg: '#F1F5F9' },
}

const SQL_ORDEN_TRABAJO = `-- Ejecutar en Supabase SQL Editor
CREATE TABLE orden_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  proyecto_id uuid REFERENCES proyecto(id),
  numero text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'trabajo'
    CHECK (tipo IN ('trabajo','inspeccion','mantenimiento','correctivo')),
  prioridad text NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('baja','normal','alta','urgente')),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),
  responsable text,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_limite date,
  fecha_completada date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE orden_trabajo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_all" ON orden_trabajo
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());`

// ── Tab: Avance de Obra ────────────────────────────────────────
function TabAvance({ proyectos }: { proyectos: ProyectoIng[] }) {
  const promedio    = proyectos.length ? Math.round(proyectos.reduce((s, p) => s + p.avance_fisico, 0) / proyectos.length) : 0
  const atrasadas   = proyectos.filter(p => p.atrasado).length
  const enRiesgo    = proyectos.filter(p => ['alto', 'critico'].includes(p.nivel_riesgo)).length

  const kpis = [
    { label: 'Obras activas',   value: proyectos.length,   unit: '' },
    { label: 'Avance promedio', value: promedio,            unit: '%' },
    { label: 'Con atraso',      value: atrasadas,           unit: '', alert: atrasadas > 0 },
    { label: 'En riesgo',       value: enRiesgo,            unit: '', alert: enRiesgo > 0 },
  ]

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: `1px solid ${k.alert ? '#FCA5A5' : '#E2E8F0'}` }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.alert ? '#DC2626' : '#1E293B' }}>{k.value}{k.unit}</div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Código','Obra','Cliente','Esperado','Real','Desvío','Fecha fin','Días','Estado'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proyectos.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Sin obras activas</td></tr>
            ) : proyectos.map(p => {
              const r = RIESGO[p.nivel_riesgo]
              const desvioColor = p.desvio >= 0 ? '#059669' : p.desvio >= -5 ? '#B45309' : p.desvio >= -10 ? '#EA580C' : '#DC2626'
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>{p.codigo}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{p.cliente}</td>
                  {/* Barra avance esperado */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${p.avance_esperado}%`, height: '100%', background: '#94A3B8', borderRadius: 3 }} />
                      </div>
                      <span style={{ color: '#94A3B8', minWidth: 32 }}>{fmtPct(p.avance_esperado)}</span>
                    </div>
                  </td>
                  {/* Barra avance real */}
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${p.avance_fisico}%`, height: '100%', background: '#2563EB', borderRadius: 3 }} />
                      </div>
                      <span style={{ color: '#1E293B', fontWeight: 600, minWidth: 32 }}>{fmtPct(p.avance_fisico)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: desvioColor }}>
                    {p.desvio >= 0 ? '+' : ''}{fmtPct(p.desvio)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{fmtFecha(p.fecha_fin_contrato)}</td>
                  <td style={{ padding: '10px 12px', color: p.atrasado ? '#DC2626' : '#64748B', fontWeight: p.atrasado ? 600 : 400 }}>
                    {p.atrasado ? `-${p.dias_restantes}d` : `${p.dias_restantes}d`}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, color: r.color, background: r.bg }}>{r.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Cronograma (CSS Gantt) ────────────────────────────────
function TabCronograma({ proyectos, partidas }: { proyectos: ProyectoIng[]; partidas: PartidaIng[] }) {
  const [proyId, setProyId] = useState(proyectos[0]?.id ?? '')
  const proy = proyectos.find(p => p.id === proyId)
  const filas = partidas.filter(pt => pt.proyecto_id === proyId)
  const conFechas = filas.filter(pt => pt.fecha_inicio && pt.fecha_fin)
  const sinFechas = filas.filter(pt => !pt.fecha_inicio || !pt.fecha_fin)

  const { minMs, maxMs, meses } = useMemo(() => {
    if (conFechas.length === 0) return { minMs: 0, maxMs: 0, meses: [] }
    const allMs = conFechas.flatMap(pt => [
      new Date(pt.fecha_inicio! + 'T00:00:00').getTime(),
      new Date(pt.fecha_fin!   + 'T00:00:00').getTime(),
    ])
    const minMs = Math.min(...allMs)
    const maxMs = Math.max(...allMs)
    const total = maxMs - minMs

    const meses: { label: string; left: number; width: number }[] = []
    const cur = new Date(minMs)
    cur.setDate(1)
    while (cur.getTime() <= maxMs) {
      const mesStart = cur.getTime()
      const mesEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 1).getTime()
      const left  = Math.max(0, (mesStart - minMs) / total * 100)
      const width = Math.min(100 - left, (Math.min(mesEnd, maxMs) - Math.max(mesStart, minMs)) / total * 100)
      meses.push({ label: cur.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }), left, width })
      cur.setMonth(cur.getMonth() + 1)
    }
    return { minMs, maxMs, meses }
  }, [conFechas])

  const totalMs = maxMs - minMs

  return (
    <div>
      {/* Selector de proyecto */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Proyecto:</span>
        <select value={proyId} onChange={e => setProyId(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#1E293B', outline: 'none' }}>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
        </select>
        {proy && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>
            {fmtFecha(proy.fecha_inicio)} → {fmtFecha(proy.fecha_fin_contrato)}
            {' · '}<strong>{filas.length}</strong> partidas
          </span>
        )}
      </div>

      {conFechas.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin fechas programadas</div>
          <div style={{ fontSize: 11 }}>Asigna fecha de inicio y fin a las partidas para ver el cronograma</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {/* Cabecera de meses */}
          <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0' }}>
            <div style={{ width: 260, flexShrink: 0, padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#64748B', borderRight: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              PARTIDA
            </div>
            <div style={{ flex: 1, position: 'relative', height: 32, background: '#F8FAFC' }}>
              {meses.map((m, i) => (
                <div key={i} style={{ position: 'absolute', left: `${m.left}%`, width: `${m.width}%`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #E2E8F0', fontSize: 9, fontWeight: 700, color: '#64748B', overflow: 'hidden' }}>
                  {m.label.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Filas de partidas */}
          {conFechas.map(pt => {
            const start  = new Date(pt.fecha_inicio! + 'T00:00:00').getTime()
            const end    = new Date(pt.fecha_fin!    + 'T00:00:00').getTime()
            const left   = ((start - minMs) / totalMs) * 100
            const width  = Math.max(0.5, ((end - start)   / totalMs) * 100)
            const barColor = pt.avance_fisico >= 100 ? '#059669' : pt.avance_fisico > 0 ? '#2563EB' : '#94A3B8'
            const doneWidth = `${pt.avance_fisico}%`
            return (
              <div key={pt.id} style={{ display: 'flex', borderBottom: '1px solid #F1F5F9', minHeight: 32 }}>
                <div style={{ width: 260, flexShrink: 0, padding: '6px 12px', borderRight: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', minWidth: 40 }}>{pt.codigo}</span>
                  <span style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{pt.descripcion}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  {/* Grid lines */}
                  {meses.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${m.left + m.width}%`, top: 0, bottom: 0, width: 1, background: '#F1F5F9' }} />
                  ))}
                  {/* Bar */}
                  <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: 14, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ width: doneWidth, height: '100%', background: barColor, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  {/* % label */}
                  {width > 5 && (
                    <div style={{ position: 'absolute', left: `${left + width + 0.5}%`, fontSize: 9, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {pt.avance_fisico}%
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {sinFechas.length > 0 && (
            <div style={{ padding: '8px 12px', fontSize: 10, color: '#94A3B8', borderTop: '1px solid #F1F5F9' }}>
              {sinFechas.length} partida(s) sin fechas asignadas: {sinFechas.map(p => p.codigo).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Presupuesto Técnico ────────────────────────────────────
function TabPresupuesto({ proyectos, partidas }: { proyectos: ProyectoIng[]; partidas: PartidaIng[] }) {
  const [proyId, setProyId] = useState(proyectos[0]?.id ?? '')
  const filas = partidas.filter(pt => pt.proyecto_id === proyId)
  const totalPartidas = filas.reduce((s, pt) => s + pt.total, 0)
  const avancePonderado = totalPartidas > 0
    ? filas.reduce((s, pt) => s + pt.total * pt.avance_fisico, 0) / totalPartidas
    : 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Proyecto:</span>
        <select value={proyId} onChange={e => setProyId(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#1E293B', outline: 'none' }}>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
        </select>
        {filas.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>
            {filas.length} ítems · Total: <strong style={{ color: '#1E293B' }}>{fmt(totalPartidas)}</strong>
            {' · '}Avance pond.: <strong style={{ color: '#2563EB' }}>{avancePonderado.toFixed(1)}%</strong>
          </span>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Código','Descripción','Und','Metrado','PU (S/)','Total (S/)','Avance','Valor ejecutado'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Descripción' ? 'left' : 'right', fontWeight: 600, color: '#374151', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {h === 'Código' || h === 'Descripción' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Sin partidas registradas para esta obra</td></tr>
            ) : filas.map(pt => (
              <tr key={pt.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{pt.codigo}</td>
                <td style={{ padding: '9px 12px', color: '#1E293B', maxWidth: 240 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.descripcion}</div>
                  {pt.responsable && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{pt.responsable}</div>}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748B' }}>{pt.unidad}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#374151' }}>{pt.metrado.toLocaleString('es-PE')}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#374151' }}>{pt.precio_unitario.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: '#1E293B' }}>{pt.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: 50, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pt.avance_fisico}%`, height: '100%', background: '#2563EB', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#374151', minWidth: 32 }}>{pt.avance_fisico}%</span>
                  </div>
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                  {(pt.total * pt.avance_fisico / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                <td colSpan={5} style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>TOTAL</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#1E293B' }}>
                  {totalPartidas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>
                  {avancePonderado.toFixed(1)}%
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                  {(filas.reduce((s, pt) => s + pt.total * pt.avance_fisico / 100, 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Tab: Consumo de Materiales ─────────────────────────────────
function TabMateriales({ proyectos }: { proyectos: ProyectoIng[] }) {
  const cats: Array<keyof ProyectoIng & string> = ['costo_material','costo_mano_obra','costo_subcontrato','costo_alquiler','costo_admin']
  const catKeys = ['material','mano_obra','subcontrato','alquiler','administracion']

  return (
    <div>
      {proyectos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Sin obras activas</div>
      )}
      {proyectos.map(p => {
        const costos = cats.map((k, i) => ({ cat: catKeys[i], total: (p[k] as number) ?? 0 }))
        const pctTotal = p.presupuesto_costo > 0 ? Math.round(p.costo_total / p.presupuesto_costo * 100) : 0
        const barColor = pctTotal > 100 ? '#DC2626' : pctTotal > 85 ? '#D97706' : '#059669'

        return (
          <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{p.codigo}</span>
              <span style={{ fontSize: 12, color: '#374151' }}>{p.nombre}</span>
              <span style={{ fontSize: 11, color: '#64748B', marginLeft: 'auto' }}>
                Ppto. costo: <strong>{fmt(p.presupuesto_costo)}</strong>
              </span>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                Ejecutado: <strong style={{ color: barColor }}>{fmt(p.costo_total)}</strong>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{pctTotal}%</span>
            </div>
            {/* Barra total */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pctTotal)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .4s' }} />
              </div>
            </div>
            {/* Categorías */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0 }}>
              {costos.map(({ cat, total }, i) => {
                const pct = p.costo_total > 0 ? Math.round(total / p.costo_total * 100) : 0
                return (
                  <div key={cat} style={{ padding: '10px 14px', borderRight: i < 4 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[cat] ?? '#94A3B8' }} />
                      <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>{CAT_LABEL[cat]}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: total > 0 ? '#1E293B' : '#D1D5DB' }}>
                      {fmt(total)}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{pct}% del total</div>
                    <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: CAT_COLOR[cat], borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Órdenes de Trabajo ────────────────────────────────────
function TabOrdenes({ ordenes, proyectos, dbExists }: { ordenes: OrdenTrabajo[]; proyectos: ProyectoIng[]; dbExists: boolean }) {
  const [showModal, setShowModal]       = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProy, setFiltroProy]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [lista, setLista]               = useState(ordenes)

  const form0 = { proyecto_id: '', numero: '', titulo: '', descripcion: '', tipo: 'trabajo', prioridad: 'normal', responsable: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_limite: '' }
  const [form, setForm] = useState(form0)

  const filtradas = lista.filter(o =>
    (!filtroEstado || o.estado === filtroEstado) &&
    (!filtroProy   || o.proyecto_id === filtroProy)
  )

  const pendientes  = lista.filter(o => o.estado === 'pendiente').length
  const en_proceso  = lista.filter(o => o.estado === 'en_proceso').length
  const completadas = lista.filter(o => o.estado === 'completada').length

  async function guardar() {
    if (!form.numero || !form.titulo) { setError('Número y título son requeridos'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('orden_trabajo')
      .insert({
        numero: form.numero, titulo: form.titulo, descripcion: form.descripcion || null,
        tipo: form.tipo, prioridad: form.prioridad, responsable: form.responsable || null,
        fecha_emision: form.fecha_emision, fecha_limite: form.fecha_limite || null,
        proyecto_id: form.proyecto_id || null,
      })
      .select('id, proyecto_id, numero, titulo, descripcion, tipo, prioridad, estado, responsable, fecha_emision, fecha_limite, fecha_completada')
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    const pNombre = proyectos.find(p => p.id === form.proyecto_id)?.nombre ?? null
    setLista(prev => [{ ...data!, proyecto_nombre: pNombre, fecha_completada: null }, ...prev])
    setShowModal(false); setForm(form0)
  }

  if (!dbExists) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FCA5A5', padding: 28 }}>
        <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 8, fontSize: 14 }}>⚠ Tabla requerida: orden_trabajo</div>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Ejecuta este SQL en el Editor SQL de Supabase para activar esta sección:</p>
        <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', color: '#1E293B', whiteSpace: 'pre-wrap' }}>
          {SQL_ORDEN_TRABAJO}
        </pre>
      </div>
    )
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Total',      value: lista.length,  color: '#1E293B' },
          { label: 'Pendientes', value: pendientes,     color: '#64748B' },
          { label: 'En proceso', value: en_proceso,     color: '#2563EB' },
          { label: 'Completadas',value: completadas,    color: '#059669' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros + botón */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', outline: 'none' }}>
          <option value=''>Todos los estados</option>
          {['pendiente','en_proceso','completada','cancelada'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select value={filtroProy} onChange={e => setFiltroProy(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', outline: 'none' }}>
          <option value=''>Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} style={{ marginLeft: 'auto', background: '#1E293B', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Nueva orden
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['N°','Título','Proyecto','Tipo','Prioridad','Estado','Fecha límite','Responsable'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Sin órdenes de trabajo</td></tr>
            ) : filtradas.map(o => {
              const p = PRIORIDAD_COLOR[o.prioridad] ?? PRIORIDAD_COLOR.normal
              const e = ESTADO_OT[o.estado] ?? ESTADO_OT.pendiente
              return (
                <tr key={o.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{o.numero}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1E293B', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</div>
                    {o.descripcion && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</div>}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11 }}>{o.proyecto_nombre ?? '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B', textTransform: 'capitalize' }}>{o.tipo}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, color: p.color, background: p.bg, textTransform: 'capitalize' }}>{o.prioridad}</span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, color: e.color, background: e.bg, textTransform: 'capitalize' }}>{o.estado.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{fmtFecha(o.fecha_limite)}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B' }}>{o.responsable ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Nueva Orden de Trabajo</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#DC2626' }}>{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Número *
                  <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="OT-001" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Fecha emisión
                  <input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
                </label>
              </div>

              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Título *
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Descripción breve de la orden" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
              </label>

              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Descripción
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={3} placeholder="Detalle de los trabajos a realizar..."
                  style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', resize: 'vertical' }} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Proyecto
                  <select value={form.proyecto_id} onChange={e => setForm(f => ({ ...f, proyecto_id: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
                    <option value=''>Sin proyecto</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Tipo
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
                    {['trabajo','inspeccion','mantenimiento','correctivo'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Prioridad
                  <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
                    {['baja','normal','alta','urgente'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Responsable
                  <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                    placeholder="Nombre" style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Fecha límite
                  <input type="date" value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={guardar} disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E293B', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
                  {saving ? 'Guardando…' : 'Crear orden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
const TABS = ['Avance', 'Cronograma', 'Presupuesto', 'Materiales', 'Órdenes']

export default function GestorIngenieria({ datos }: { datos: DatosIngenieria }) {
  const [tab, setTab] = useState(0)
  const { proyectos, partidas, ordenes, dbOrdenTrabajo } = datos

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Ingeniería</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>Control técnico operativo de obras · {proyectos.length} obras activas</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding: '0 26px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((label, i) => (
            <button key={i} onClick={() => setTab(i)}
              style={{ padding: '10px 16px', fontSize: 12, fontWeight: tab === i ? 700 : 400, color: tab === i ? '#1E293B' : '#64748B', background: 'none', border: 'none', borderBottom: tab === i ? '2px solid #1E293B' : '2px solid transparent', cursor: 'pointer', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: '22px 26px' }}>
        {tab === 0 && <TabAvance proyectos={proyectos} />}
        {tab === 1 && <TabCronograma proyectos={proyectos} partidas={partidas} />}
        {tab === 2 && <TabPresupuesto proyectos={proyectos} partidas={partidas} />}
        {tab === 3 && <TabMateriales proyectos={proyectos} />}
        {tab === 4 && <TabOrdenes ordenes={ordenes} proyectos={proyectos} dbExists={dbOrdenTrabajo} />}
      </div>
    </div>
  )
}
