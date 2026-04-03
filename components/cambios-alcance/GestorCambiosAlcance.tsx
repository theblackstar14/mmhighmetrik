'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DatosCambiosAlcance, CambioAlcance } from '@/lib/cambios-alcance'

// ── Helpers ───────────────────────────────────────────────────
const fmt      = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtFecha = (s: string | null) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const ESTADO_COLOR: Record<string, { color: string; bg: string }> = {
  solicitado:  { color: '#B45309', bg: '#FFFBEB' },
  en_revision: { color: '#2563EB', bg: '#EFF6FF' },
  aprobado:    { color: '#059669', bg: '#ECFDF5' },
  rechazado:   { color: '#DC2626', bg: '#FEF2F2' },
}
const TIPO_COLOR: Record<string, { color: string; bg: string }> = {
  adicional:  { color: '#7C3AED', bg: '#F5F3FF' },
  deductivo:  { color: '#DC2626', bg: '#FEF2F2' },
}

const SQL_SETUP = `-- Ejecutar en Supabase SQL Editor
CREATE TABLE cambio_alcance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  proyecto_id uuid NOT NULL REFERENCES proyecto(id),
  tipo text NOT NULL CHECK (tipo IN ('adicional','deductivo')),
  numero_cambio int,
  descripcion text NOT NULL,
  monto numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'solicitado'
    CHECK (estado IN ('solicitado','en_revision','aprobado','rechazado')),
  solicitado_por text,
  fecha_solicitud date NOT NULL DEFAULT CURRENT_DATE,
  fecha_aprobacion date,
  aprobado_por text,
  observaciones text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cambio_alcance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_all" ON cambio_alcance
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());`

// ── Modal nuevo/editar cambio ──────────────────────────────────
interface ModalProps {
  proyectos: DatosCambiosAlcance['proyectos']
  onClose: () => void
  onSaved: (c: CambioAlcance) => void
}

function ModalNuevo({ proyectos, onClose, onSaved }: ModalProps) {
  const form0 = {
    proyecto_id: proyectos[0]?.id ?? '',
    tipo: 'adicional' as const,
    numero_cambio: '',
    descripcion: '',
    monto: '',
    estado: 'solicitado' as const,
    solicitado_por: '',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    observaciones: '',
  }
  const [form, setForm] = useState(form0)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function guardar() {
    if (!form.proyecto_id || !form.descripcion || !form.monto) {
      setError('Proyecto, descripción y monto son requeridos'); return
    }
    setSaving(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('cambio_alcance')
      .insert({
        proyecto_id:    form.proyecto_id,
        tipo:           form.tipo,
        numero_cambio:  form.numero_cambio ? Number(form.numero_cambio) : null,
        descripcion:    form.descripcion,
        monto:          Number(form.monto),
        estado:         form.estado,
        solicitado_por: form.solicitado_por || null,
        fecha_solicitud: form.fecha_solicitud,
        observaciones:  form.observaciones || null,
      })
      .select('id, proyecto_id, tipo, numero_cambio, descripcion, monto, estado, solicitado_por, fecha_solicitud, fecha_aprobacion, aprobado_por, observaciones')
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    const proy = proyectos.find(p => p.id === form.proyecto_id)
    onSaved({ ...data!, proyecto_codigo: proy?.codigo ?? '—', proyecto_nombre: proy?.nombre ?? '—' })
    onClose()
  }

  const field = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <input
        {...props}
        value={String((form as any)[key] ?? '')}
        onChange={e => set(key, e.target.value)}
        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', ...(props.style ?? {}) }}
      />
    </label>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>Nuevo Cambio de Alcance</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#DC2626' }}>{error}</div>}

          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Proyecto *
            <select value={form.proyecto_id} onChange={e => set('proyecto_id', e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Tipo *
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
                <option value="adicional">Adicional</option>
                <option value="deductivo">Deductivo</option>
              </select>
            </label>
            {field('N° Cambio', 'numero_cambio', { type: 'number', placeholder: '001' })}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Descripción *
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={3} placeholder="Descripción del cambio de alcance..."
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Monto (S/) *', 'monto', { type: 'number', placeholder: '0.00', min: '0' })}
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Estado
              <select value={form.estado} onChange={e => set('estado', e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
                <option value="solicitado">Solicitado</option>
                <option value="en_revision">En revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Solicitado por', 'solicitado_por', { placeholder: 'Nombre del solicitante' })}
            {field('Fecha solicitud', 'fecha_solicitud', { type: 'date' })}
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Observaciones
            <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
              rows={2} placeholder="Notas adicionales..."
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1E293B', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : 'Registrar cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function GestorCambiosAlcance({ datos }: { datos: DatosCambiosAlcance }) {
  const { proyectos, dbExists } = datos
  const [lista, setLista]         = useState<CambioAlcance[]>(datos.cambios)
  const [showModal, setShowModal] = useState(false)
  const [filtroTipo, setFiltroTipo]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProy, setFiltroProy]     = useState('')

  const filtradas = lista.filter(c =>
    (!filtroTipo   || c.tipo   === filtroTipo) &&
    (!filtroEstado || c.estado === filtroEstado) &&
    (!filtroProy   || c.proyecto_id === filtroProy)
  )

  // KPIs
  const aprobados     = lista.filter(c => c.estado === 'aprobado')
  const adicionales   = aprobados.filter(c => c.tipo === 'adicional').reduce((s, c) => s + c.monto, 0)
  const deductivos    = aprobados.filter(c => c.tipo === 'deductivo').reduce((s, c) => s + c.monto, 0)
  const neto          = adicionales - deductivos
  const pendientes    = lista.filter(c => ['solicitado', 'en_revision'].includes(c.estado)).length

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Cambios de Alcance</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>Adicionales y deductivos · control de variaciones de contrato</p>
        </div>
        {dbExists && (
          <button onClick={() => setShowModal(true)}
            style={{ background: '#1E293B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Nuevo cambio
          </button>
        )}
      </div>

      <div style={{ padding: '22px 26px' }}>

        {/* ── Setup card si no existe la tabla ── */}
        {!dbExists && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FCA5A5', padding: 28, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 8, fontSize: 14 }}>⚠ Tabla requerida: cambio_alcance</div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Ejecuta este SQL en el Editor SQL de Supabase para activar este módulo:</p>
            <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', color: '#1E293B', whiteSpace: 'pre-wrap' }}>
              {SQL_SETUP}
            </pre>
          </div>
        )}

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Adicionales aprobados', value: fmt(adicionales), color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
            { label: 'Deductivos aprobados',  value: fmt(deductivos),  color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
            { label: 'Impacto neto',           value: fmt(neto),        color: neto >= 0 ? '#059669' : '#DC2626', bg: neto >= 0 ? '#ECFDF5' : '#FEF2F2', border: neto >= 0 ? '#6EE7B7' : '#FCA5A5' },
            { label: 'Pendientes de revisión', value: String(pendientes), color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, borderRadius: 10, padding: '14px 18px', border: `1px solid ${k.border}` }}>
              <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4, fontWeight: 500 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Impacto por proyecto ── */}
        {proyectos.length > 0 && lista.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>Impacto en contrato por obra</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {proyectos.filter(p => lista.some(c => c.proyecto_id === p.id)).map(p => {
                const cambiosProy = lista.filter(c => c.proyecto_id === p.id && c.estado === 'aprobado')
                const adicProy    = cambiosProy.filter(c => c.tipo === 'adicional').reduce((s, c) => s + c.monto, 0)
                const dedProy     = cambiosProy.filter(c => c.tipo === 'deductivo').reduce((s, c) => s + c.monto, 0)
                const netoProy    = adicProy - dedProy
                const pct         = p.presupuesto_contrato > 0 ? Math.round(netoProy / p.presupuesto_contrato * 100) : 0
                const pendProy    = lista.filter(c => c.proyecto_id === p.id && ['solicitado','en_revision'].includes(c.estado)).length
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 90, fontSize: 11, fontWeight: 600, color: '#374151', flexShrink: 0 }}>{p.codigo}</div>
                    <div style={{ flex: 1, fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: '#64748B', flexShrink: 0, minWidth: 120 }}>Contrato: <strong>{fmt(p.presupuesto_contrato)}</strong></div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: netoProy >= 0 ? '#7C3AED' : '#DC2626', flexShrink: 0, minWidth: 90 }}>
                      {netoProy >= 0 ? '+' : ''}{fmt(netoProy)}
                    </div>
                    <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: Math.abs(pct) > 15 ? '#FEF2F2' : '#F8FAFC', color: Math.abs(pct) > 15 ? '#DC2626' : '#64748B', flexShrink: 0 }}>
                      {pct >= 0 ? '+' : ''}{pct}%
                    </div>
                    {pendProy > 0 && (
                      <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#FFFBEB', color: '#B45309', flexShrink: 0 }}>
                        {pendProy} pendiente{pendProy > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', outline: 'none' }}>
            <option value=''>Adicionales y deductivos</option>
            <option value='adicional'>Solo adicionales</option>
            <option value='deductivo'>Solo deductivos</option>
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', outline: 'none' }}>
            <option value=''>Todos los estados</option>
            <option value='solicitado'>Solicitado</option>
            <option value='en_revision'>En revisión</option>
            <option value='aprobado'>Aprobado</option>
            <option value='rechazado'>Rechazado</option>
          </select>
          <select value={filtroProy} onChange={e => setFiltroProy(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', outline: 'none' }}>
            <option value=''>Todas las obras</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>{filtradas.length} registros</span>
        </div>

        {/* ── Tabla ── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['N°','Tipo','Obra','Descripción','Monto','Estado','Solicitado por','Fecha','Observaciones'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                    {dbExists ? 'Sin cambios de alcance registrados' : 'Configura la tabla para comenzar'}
                  </td>
                </tr>
              ) : filtradas.map(c => {
                const tipoC   = TIPO_COLOR[c.tipo]   ?? TIPO_COLOR.adicional
                const estadoC = ESTADO_COLOR[c.estado] ?? ESTADO_COLOR.solicitado
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>
                      {c.numero_cambio ? String(c.numero_cambio).padStart(3, '0') : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: tipoC.color, background: tipoC.bg, textTransform: 'capitalize' }}>{c.tipo}</span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: '#374151' }}>{c.proyecto_codigo}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{c.proyecto_nombre}</div>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#1E293B', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descripcion}</div>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: c.tipo === 'adicional' ? '#7C3AED' : '#DC2626', whiteSpace: 'nowrap' }}>
                      {c.tipo === 'adicional' ? '+' : '−'}{fmt(c.monto)}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, color: estadoC.color, background: estadoC.bg, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {c.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11 }}>{c.solicitado_por ?? '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha_solicitud)}</td>
                    <td style={{ padding: '9px 12px', color: '#94A3B8', fontSize: 11, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.observaciones ?? '—'}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <ModalNuevo
          proyectos={proyectos}
          onClose={() => setShowModal(false)}
          onSaved={c => setLista(prev => [c, ...prev])}
        />
      )}
    </div>
  )
}
