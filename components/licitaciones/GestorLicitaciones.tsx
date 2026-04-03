'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DatosLicitaciones, Licitacion } from '@/lib/licitaciones'

const SQL_LICITACION = `-- Ejecutar en Supabase SQL Editor
CREATE TABLE licitacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  codigo text,
  nombre text NOT NULL,
  entidad text NOT NULL,
  tipo text NOT NULL DEFAULT 'publica'
    CHECK (tipo IN ('publica','privada','internacional')),
  modalidad text,
  ubicacion text,
  descripcion text,
  monto_referencial numeric(14,2),
  monto_ofertado numeric(14,2),
  monto_adjudicado numeric(14,2),
  estado text NOT NULL DEFAULT 'evaluando'
    CHECK (estado IN ('evaluando','preparando','presentada','ganada','perdida','desierta','retirada')),
  probabilidad int NOT NULL DEFAULT 50
    CHECK (probabilidad BETWEEN 0 AND 100),
  fecha_publicacion date,
  fecha_presentacion date,
  fecha_resultado date,
  responsable text,
  observaciones text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE licitacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_all" ON licitacion
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());`

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number | null) =>
  n == null ? '—' : `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtM = (n: number | null) =>
  n == null ? '—' : `S/ ${(n / 1000000).toFixed(2)}M`
const fmtFecha = (s: string | null) =>
  s ? new Date(s + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── Colores ───────────────────────────────────────────────────
const ESTADO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  evaluando:  { label: 'Evaluando',   color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  preparando: { label: 'Preparando',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  presentada: { label: 'Presentada',  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  ganada:     { label: 'Ganada',      color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  perdida:    { label: 'Perdida',     color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  desierta:   { label: 'Desierta',    color: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
  retirada:   { label: 'Retirada',    color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
}
const TIPO: Record<string, { label: string; color: string; bg: string }> = {
  publica:        { label: 'Pública',        color: '#1D4ED8', bg: '#DBEAFE' },
  privada:        { label: 'Privada',        color: '#6D28D9', bg: '#EDE9FE' },
  internacional:  { label: 'Internacional',  color: '#0F766E', bg: '#CCFBF1' },
}

function DiasChip({ dias, vencida }: { dias: number | null; vencida: boolean }) {
  if (dias === null) return <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>
  if (vencida) return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color: '#DC2626', background: '#FEF2F2' }}>Vencida</span>
  const color = dias <= 7 ? '#DC2626' : dias <= 15 ? '#EA580C' : dias <= 30 ? '#D97706' : '#059669'
  const bg    = dias <= 7 ? '#FEF2F2' : dias <= 15 ? '#FFF7ED' : dias <= 30 ? '#FFFBEB' : '#ECFDF5'
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color, background: bg }}>{dias}d</span>
}

function ProbChip({ v }: { v: number }) {
  const color = v >= 70 ? '#059669' : v >= 40 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 36, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{v}%</span>
    </div>
  )
}

// ── Modal crear/editar ────────────────────────────────────────
interface ModalProps {
  licitacion?: Licitacion
  onClose: () => void
  onSaved: (l: Licitacion) => void
  onObraCreada: (id: string, nombre: string) => void
}

function ModalLicitacion({ licitacion, onClose, onSaved, onObraCreada }: ModalProps) {
  const hoy = new Date().toISOString().split('T')[0]
  const f0 = licitacion ?? {
    codigo: '', nombre: '', entidad: '', tipo: 'publica' as const, modalidad: '',
    ubicacion: '', descripcion: '', monto_referencial: '', monto_ofertado: '',
    monto_adjudicado: '', estado: 'evaluando' as const, probabilidad: 50,
    fecha_publicacion: hoy, fecha_presentacion: '', fecha_resultado: '',
    responsable: '', observaciones: '',
  }
  const [form, setForm] = useState<any>({ ...f0 })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const editing = !!licitacion

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  async function guardar() {
    if (!form.nombre || !form.entidad) { setError('Nombre y entidad son requeridos'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const payload: any = {
      nombre: form.nombre, entidad: form.entidad, tipo: form.tipo,
      modalidad: form.modalidad || null, ubicacion: form.ubicacion || null,
      descripcion: form.descripcion || null, codigo: form.codigo || null,
      monto_referencial:  form.monto_referencial  ? Number(form.monto_referencial)  : null,
      monto_ofertado:     form.monto_ofertado     ? Number(form.monto_ofertado)     : null,
      monto_adjudicado:   form.monto_adjudicado   ? Number(form.monto_adjudicado)   : null,
      estado: form.estado, probabilidad: Number(form.probabilidad),
      fecha_convocatoria: form.fecha_publicacion  || null,
      fecha_presentacion: form.fecha_presentacion || null,
      fecha_buena_pro:    form.fecha_resultado    || null,
      responsable:   form.responsable   || null,
      observaciones: form.observaciones || null,
    }
    const { data, error: err } = editing
      ? await supabase.from('licitacion').update(payload).eq('id', licitacion!.id).select('*').single()
      : await supabase.from('licitacion').insert(payload).select('*').single()
    setSaving(false)
    if (err) { setError(err.message); return }
    const today = new Date(); today.setHours(0,0,0,0)
    const fp = data.fecha_presentacion ? new Date(data.fecha_presentacion + 'T00:00:00') : null
    const dias_restantes = fp ? Math.round((fp.getTime() - today.getTime()) / 86400000) : null
    onSaved({ ...data, dias_restantes, vencida: dias_restantes !== null && dias_restantes < 0 })

    // ── Crear obra si se acaba de ganar ──────────────────────
    const estabaGanada = licitacion?.estado === 'ganada'
    if (form.estado === 'ganada' && !estabaGanada) {
      const { data: usuario } = await supabase.from('usuario').select('empresa_id').single()
      if (usuario?.empresa_id) {
        const montoContrato = Number(form.monto_adjudicado || form.monto_referencial || 0)
        const tipoObra      = form.tipo === 'publica' ? 'publico' : 'privado'
        const codigoObra    = form.codigo
          ? `OBR-${form.codigo}`
          : `OBR-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`

        const { data: obra } = await supabase.from('proyecto').insert({
          empresa_id:           usuario.empresa_id,
          codigo:               codigoObra,
          nombre:               form.nombre,
          cliente:              form.entidad,
          tipo:                 tipoObra,
          estado:               'activo',
          presupuesto_contrato: montoContrato,
          presupuesto_costo:    0,
          avance_fisico:        0,
          ubicacion:            form.ubicacion || null,
          fecha_inicio:         form.fecha_resultado || today.toISOString().split('T')[0],
        }).select('id, nombre').single()

        if (obra) onObraCreada(obra.id, obra.nombre)
      }
    }

    onClose()
  }

  const inp = (label: string, key: string, props: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <input value={String(form[key] ?? '')} onChange={e => set(key, e.target.value)} {...props}
        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none' }} />
    </label>
  )
  const sel = (label: string, key: string, opts: { v: string; l: string }[]) => (
    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <select value={form[key]} onChange={e => set(key, e.target.value)}
        style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>{editing ? 'Editar licitación' : 'Nueva licitación'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#DC2626' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            {inp('Código', 'codigo', { placeholder: 'LP-001' })}
            {inp('Nombre del proyecto / concurso *', 'nombre', { placeholder: 'Nombre de la licitación' })}
          </div>
          {inp('Entidad convocante *', 'entidad', { placeholder: 'MTC, Municipalidad de..., empresa privada...' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {sel('Tipo', 'tipo', [{ v:'publica',l:'Pública' },{ v:'privada',l:'Privada' },{ v:'internacional',l:'Internacional' }])}
            {inp('Modalidad', 'modalidad', { placeholder: 'LP, CP, AS, CD...' })}
            {inp('Ubicación', 'ubicacion', { placeholder: 'Departamento / ciudad' })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {inp('Monto referencial (S/)', 'monto_referencial', { type:'number', placeholder:'0.00', min:'0' })}
            {inp('Monto ofertado (S/)',    'monto_ofertado',    { type:'number', placeholder:'0.00', min:'0' })}
            {inp('Monto adjudicado (S/)',  'monto_adjudicado',  { type:'number', placeholder:'0.00', min:'0' })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {sel('Estado', 'estado', [
              { v:'evaluando',l:'Evaluando' },{ v:'preparando',l:'Preparando' },{ v:'presentada',l:'Presentada' },
              { v:'ganada',l:'Ganada' },{ v:'perdida',l:'Perdida' },{ v:'desierta',l:'Desierta' },{ v:'retirada',l:'Retirada' },
            ])}
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Probabilidad de ganar: <strong style={{ color: '#2563EB' }}>{form.probabilidad}%</strong>
              <input type="range" min={0} max={100} step={5} value={form.probabilidad} onChange={e => set('probabilidad', e.target.value)}
                style={{ width: '100%', accentColor: '#2563EB' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {inp('Fecha publicación', 'fecha_publicacion', { type:'date' })}
            {inp('Fecha presentación', 'fecha_presentacion', { type:'date' })}
            {inp('Fecha resultado',   'fecha_resultado',    { type:'date' })}
          </div>

          {inp('Responsable', 'responsable', { placeholder: 'Nombre del responsable interno' })}

          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
            Descripción / Observaciones
            <textarea value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)}
              rows={3} placeholder="Detalles, alcance, notas relevantes..."
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1E293B', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar licitación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Resumen ──────────────────────────────────────────────
function TabResumen({ lista, onNueva }: { lista: Licitacion[]; onNueva: () => void }) {
  const activas   = lista.filter(l => ['evaluando','preparando','presentada'].includes(l.estado))
  const cerradas  = lista.filter(l => ['ganada','perdida','desierta'].includes(l.estado))
  const ganadas   = lista.filter(l => l.estado === 'ganada')
  const winRate   = cerradas.length > 0 ? Math.round(ganadas.length / cerradas.length * 100) : 0
  const montoJuego= activas.reduce((s, l) => s + (l.monto_referencial ?? 0), 0)
  const montoGanado = ganadas.reduce((s, l) => s + (l.monto_adjudicado ?? l.monto_referencial ?? 0), 0)
  const urgentes  = activas.filter(l => l.dias_restantes !== null && l.dias_restantes <= 15 && !l.vencida)
    .sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999))

  // Embudo
  const embudo = [
    { estado: 'evaluando',  label: 'Evaluando',  n: lista.filter(l=>l.estado==='evaluando').length },
    { estado: 'preparando', label: 'Preparando', n: lista.filter(l=>l.estado==='preparando').length },
    { estado: 'presentada', label: 'Presentada', n: lista.filter(l=>l.estado==='presentada').length },
    { estado: 'ganada',     label: 'Ganada',     n: ganadas.length },
  ]
  const maxN = Math.max(...embudo.map(e => e.n), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Monto en juego',     value: montoJuego >= 1e6 ? fmtM(montoJuego) : fmt(montoJuego), sub: `${activas.length} licitaciones activas`, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
          { label: 'Monto ganado (total)',value: montoGanado >= 1e6 ? fmtM(montoGanado) : fmt(montoGanado), sub: `${ganadas.length} adjudicadas`,       color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
          { label: 'Tasa de éxito',      value: `${winRate}%`,    sub: `${ganadas.length} de ${cerradas.length} cerradas`,   color: winRate >= 50 ? '#059669' : winRate >= 30 ? '#D97706' : '#DC2626', bg: '#F8FAFC', border: '#E2E8F0' },
          { label: 'Próximas ≤ 15 días', value: String(urgentes.length), sub: 'requieren atención',         color: urgentes.length > 0 ? '#DC2626' : '#059669', bg: urgentes.length > 0 ? '#FEF2F2' : '#ECFDF5', border: urgentes.length > 0 ? '#FCA5A5' : '#6EE7B7' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, borderRadius: 10, padding: '16px 20px', border: `1px solid ${k.border}` }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4, fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Embudo */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Embudo de licitaciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {embudo.map(e => {
              const ec = ESTADO[e.estado]
              const pct = (e.n / maxN) * 100
              return (
                <div key={e.estado}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{e.label}</span>
                    <span style={{ fontWeight: 700, color: ec.color }}>{e.n}</span>
                  </div>
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: ec.color, borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Próximas urgentes */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Próximas presentaciones (≤ 15 días)</div>
          {urgentes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>Sin presentaciones urgentes</div>
          ) : urgentes.slice(0, 5).map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{l.entidad} · {fmtFecha(l.fecha_presentacion)}</div>
              </div>
              <DiasChip dias={l.dias_restantes} vencida={l.vencida} />
            </div>
          ))}
          {lista.length === 0 && (
            <button onClick={onNueva} style={{ width: '100%', marginTop: 12, padding: '8px', borderRadius: 7, border: '1px dashed #D1D5DB', background: 'transparent', fontSize: 12, color: '#94A3B8', cursor: 'pointer' }}>
              + Registrar primera licitación
            </button>
          )}
        </div>
      </div>

      {/* Últimas registradas */}
      {lista.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, color: '#1E293B' }}>
            Actividad reciente
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Nombre','Entidad','Tipo','Monto ref.','Estado','Días restantes','Probabilidad'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 8).map(l => {
                const ec = ESTADO[l.estado] ?? ESTADO.evaluando
                const tc = TIPO[l.tipo]    ?? TIPO.publica
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1E293B', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</td>
                    <td style={{ padding: '9px 12px', color: '#64748B', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{l.entidad}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, color: tc.color, background: tc.bg }}>{tc.label}</span></td>
                    <td style={{ padding: '9px 12px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.monto_referencial ? fmt(l.monto_referencial) : '—'}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color: ec.color, background: ec.bg }}>{ec.label}</span></td>
                    <td style={{ padding: '9px 12px' }}><DiasChip dias={l.dias_restantes} vencida={l.vencida} /></td>
                    <td style={{ padding: '9px 12px' }}><ProbChip v={l.probabilidad} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Pipeline ─────────────────────────────────────────────
function TabPipeline({ lista, onNueva, onEdit }: { lista: Licitacion[]; onNueva: () => void; onEdit: (l: Licitacion) => void }) {
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [buscar,       setBuscar]       = useState('')

  const activos = lista.filter(l => !['ganada','perdida','desierta','retirada'].includes(l.estado))
  const filtradas = activos.filter(l =>
    (!filtroEstado || l.estado === filtroEstado) &&
    (!filtroTipo   || l.tipo   === filtroTipo) &&
    (!buscar       || l.nombre.toLowerCase().includes(buscar.toLowerCase()) || l.entidad.toLowerCase().includes(buscar.toLowerCase()))
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o entidad..."
          style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', width: 220 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
          <option value=''>Todos los estados</option>
          {['evaluando','preparando','presentada'].map(s => <option key={s} value={s}>{ESTADO[s].label}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
          <option value=''>Todos los tipos</option>
          {Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>{filtradas.length} licitaciones</span>
        <button onClick={onNueva} style={{ background: '#1E293B', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Nueva licitación
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Cód.','Nombre','Entidad','Tipo','Modal.','Monto ref.','Ofertado','Estado','Días','Prob.','Responsable',''].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Sin licitaciones activas</td></tr>
            ) : filtradas.map(l => {
              const ec = ESTADO[l.estado] ?? ESTADO.evaluando
              const tc = TIPO[l.tipo]    ?? TIPO.publica
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }} onClick={() => onEdit(l)}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{l.codigo ?? '—'}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1E293B', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                    {l.ubicacion && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{l.ubicacion}</div>}
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11, maxWidth: 140 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.entidad}</div>
                  </td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, color: tc.color, background: tc.bg }}>{tc.label}</span></td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11 }}>{l.modalidad ?? '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.monto_referencial ? fmt(l.monto_referencial) : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{l.monto_ofertado ? fmt(l.monto_ofertado) : '—'}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color: ec.color, background: ec.bg }}>{ec.label}</span></td>
                  <td style={{ padding: '9px 12px' }}><DiasChip dias={l.dias_restantes} vencida={l.vencida} /></td>
                  <td style={{ padding: '9px 12px' }}><ProbChip v={l.probabilidad} /></td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11 }}>{l.responsable ?? '—'}</td>
                  <td style={{ padding: '9px 6px' }}><span style={{ fontSize: 10, color: '#94A3B8' }}>✎</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Análisis ─────────────────────────────────────────────
function TabAnalisis({ lista }: { lista: Licitacion[] }) {
  const cerradas  = lista.filter(l => ['ganada','perdida','desierta'].includes(l.estado))
  const ganadas   = lista.filter(l => l.estado === 'ganada')
  const perdidas  = lista.filter(l => l.estado === 'perdida')
  const desiertas = lista.filter(l => l.estado === 'desierta')
  const winRate   = cerradas.length > 0 ? Math.round(ganadas.length / cerradas.length * 100) : 0

  const porTipo = Object.entries(TIPO).map(([k, v]) => {
    const sub = lista.filter(l => l.tipo === k)
    const gan = sub.filter(l => l.estado === 'ganada')
    return {
      tipo: v.label, color: v.color, bg: v.bg,
      total: sub.length,
      monto_ref: sub.reduce((s, l) => s + (l.monto_referencial ?? 0), 0),
      monto_gan: gan.reduce((s, l) => s + (l.monto_adjudicado ?? l.monto_referencial ?? 0), 0),
      ganadas: gan.length,
      wr: sub.filter(l => ['ganada','perdida','desierta'].includes(l.estado)).length > 0
        ? Math.round(gan.length / sub.filter(l => ['ganada','perdida','desierta'].includes(l.estado)).length * 100) : 0,
    }
  }).filter(r => r.total > 0)

  // Tendencia por mes (últimos 12 meses)
  const meses: Record<string, { presentadas: number; ganadas: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    meses[key] = { presentadas: 0, ganadas: 0 }
  }
  for (const l of lista) {
    const fp = l.fecha_presentacion
    if (fp) {
      const key = fp.slice(0, 7)
      if (meses[key]) {
        meses[key].presentadas++
        if (l.estado === 'ganada') meses[key].ganadas++
      }
    }
  }
  const tendencia = Object.entries(meses).map(([k, v]) => ({
    mes: new Date(k + '-01').toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
    ...v,
    maxVal: Math.max(...Object.values(meses).map(x => x.presentadas), 1),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Win rate grande */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        {[
          { label: 'Tasa de éxito', value: `${winRate}%`, sub: `${ganadas.length} ganadas de ${cerradas.length} cerradas`, color: winRate >= 50 ? '#059669' : winRate >= 30 ? '#D97706' : '#DC2626' },
          { label: 'Licitaciones ganadas', value: String(ganadas.length), sub: `S/ ${(ganadas.reduce((s,l)=>s+(l.monto_adjudicado??l.monto_referencial??0),0)/1e6).toFixed(2)}M adjudicados`, color: '#059669' },
          { label: 'Perdidas / Desiertas', value: `${perdidas.length} / ${desiertas.length}`, sub: `de ${cerradas.length} licitaciones cerradas`, color: '#DC2626' },
          { label: 'En pipeline activo', value: String(lista.filter(l=>['evaluando','preparando','presentada'].includes(l.estado)).length), sub: `S/ ${(lista.filter(l=>['evaluando','preparando','presentada'].includes(l.estado)).reduce((s,l)=>s+(l.monto_referencial??0),0)/1e6).toFixed(2)}M en juego`, color: '#2563EB' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Por tipo */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Resultados por tipo</div>
          {porTipo.length === 0
            ? <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Sin datos</div>
            : porTipo.map(r => (
              <div key={r.tipo} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: r.color, background: r.bg }}>{r.tipo}</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>{r.total} licitaciones · WR: <strong style={{ color: r.wr >= 50 ? '#059669' : '#D97706' }}>{r.wr}%</strong></span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                  <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ color: '#94A3B8', marginBottom: 2 }}>Monto referencial total</div>
                    <div style={{ fontWeight: 700, color: '#1E293B' }}>{r.monto_ref >= 1e6 ? fmtM(r.monto_ref) : fmt(r.monto_ref)}</div>
                  </div>
                  <div style={{ background: '#ECFDF5', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ color: '#94A3B8', marginBottom: 2 }}>Monto ganado</div>
                    <div style={{ fontWeight: 700, color: '#059669' }}>{r.monto_gan >= 1e6 ? fmtM(r.monto_gan) : fmt(r.monto_gan)}</div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Tendencia mensual */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Presentaciones por mes (12m)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {tendencia.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 90, gap: 1 }}>
                  {m.presentadas > 0 && (
                    <div style={{ width: '100%', height: `${(m.presentadas / m.maxVal) * 80}px`, background: '#BFDBFE', borderRadius: '2px 2px 0 0', minHeight: 4, position: 'relative' }}>
                      {m.ganadas > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(m.ganadas / m.presentadas) * 100}%`, background: '#2563EB', borderRadius: '2px 2px 0 0', minHeight: 2 }} />
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 28 }}>{m.mes}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#BFDBFE' }} /><span style={{ fontSize: 10, color: '#64748B' }}>Presentadas</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#2563EB' }} /><span style={{ fontSize: 10, color: '#64748B' }}>Ganadas</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Historial ────────────────────────────────────────────
function TabHistorial({ lista }: { lista: Licitacion[] }) {
  const [filtro, setFiltro] = useState('')
  const historial = lista.filter(l => ['ganada','perdida','desierta','retirada'].includes(l.estado))
  const filtradas = historial.filter(l => !filtro || l.estado === filtro)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', background: '#fff' }}>
          <option value=''>Todos los resultados</option>
          {['ganada','perdida','desierta','retirada'].map(s => <option key={s} value={s}>{ESTADO[s].label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>{filtradas.length} registros</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Nombre','Entidad','Tipo','Monto ref.','Monto adjudicado','Resultado','Fecha resultado','Responsable'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Sin historial de licitaciones cerradas</td></tr>
            ) : filtradas.map(l => {
              const ec = ESTADO[l.estado] ?? ESTADO.evaluando
              const tc = TIPO[l.tipo]    ?? TIPO.publica
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1E293B', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.entidad}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, color: tc.color, background: tc.bg }}>{tc.label}</span></td>
                  <td style={{ padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{l.monto_referencial ? fmt(l.monto_referencial) : '—'}</td>
                  <td style={{ padding: '9px 12px', fontWeight: l.estado === 'ganada' ? 700 : 400, color: l.estado === 'ganada' ? '#059669' : '#94A3B8', whiteSpace: 'nowrap' }}>
                    {l.estado === 'ganada' && l.monto_adjudicado ? fmt(l.monto_adjudicado) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, color: ec.color, background: ec.bg }}>{ec.label}</span></td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtFecha(l.fecha_resultado)}</td>
                  <td style={{ padding: '9px 12px', color: '#64748B', fontSize: 11 }}>{l.responsable ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Componente raíz ───────────────────────────────────────────
const TABS = ['Resumen', 'Pipeline activo', 'Análisis', 'Historial']

export default function GestorLicitaciones({ datos }: { datos: DatosLicitaciones }) {
  const [tab,        setTab]       = useState(0)
  const [lista,      setLista]     = useState<Licitacion[]>(datos.licitaciones)
  const [showModal,  setShowModal] = useState(false)
  const [editando,   setEditando]  = useState<Licitacion | undefined>()
  const [obraCreada, setObraCreada] = useState<{ id: string; nombre: string } | null>(null)

  const activas = lista.filter(l => ['evaluando','preparando','presentada'].includes(l.estado))

  function abrirNueva()               { setEditando(undefined); setShowModal(true) }
  function abrirEditar(l: Licitacion) { setEditando(l);         setShowModal(true) }

  function onSaved(l: Licitacion) {
    setLista(prev => {
      const idx = prev.findIndex(x => x.id === l.id)
      return idx >= 0 ? prev.map(x => x.id === l.id ? l : x) : [l, ...prev]
    })
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Licitaciones</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>
            Gestión de concursos y adjudicaciones · {activas.length} activas
          </p>
        </div>
        {datos.dbExists && (
          <button onClick={abrirNueva} style={{ background: '#1E293B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Nueva licitación
          </button>
        )}
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

      {/* ── Banner obra creada ── */}
      {obraCreada && (
        <div style={{ margin: '12px 26px 0', padding: '12px 18px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>¡Licitación ganada! Obra creada automáticamente</div>
              <div style={{ fontSize: 11, color: '#059669', marginTop: 1 }}>{obraCreada.nombre}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href={`/obras/${obraCreada.id}`}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, background: '#059669', color: '#fff', textDecoration: 'none' }}>
              Ver obra →
            </a>
            <button onClick={() => setObraCreada(null)}
              style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6EE7B7' }}>✕</button>
          </div>
        </div>
      )}

      {/* ── Contenido ── */}
      <div style={{ padding: '22px 26px' }}>
        {!datos.dbExists && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FCA5A5', padding: 28, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: 8, fontSize: 14 }}>⚠ Tabla requerida: licitacion</div>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Ejecuta este SQL en el Editor SQL de Supabase:</p>
            <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', color: '#1E293B', whiteSpace: 'pre-wrap' }}>
              {SQL_LICITACION}
            </pre>
          </div>
        )}
        {tab === 0 && <TabResumen   lista={lista} onNueva={abrirNueva} />}
        {tab === 1 && <TabPipeline  lista={lista} onNueva={abrirNueva} onEdit={abrirEditar} />}
        {tab === 2 && <TabAnalisis  lista={lista} />}
        {tab === 3 && <TabHistorial lista={lista} />}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <ModalLicitacion
          licitacion={editando}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
          onObraCreada={(id, nombre) => setObraCreada({ id, nombre })}
        />
      )}
    </div>
  )
}
