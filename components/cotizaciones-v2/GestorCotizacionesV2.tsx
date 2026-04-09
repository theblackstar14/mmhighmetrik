'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Partida {
  item: string
  descripcion: string
  unidad: string | null
  metrado: number | null
  precio_unitario: number | null
  parcial: number | null
  es_titulo: boolean
}

interface Cotizacion {
  id?: string
  numero_cot: string
  revision: string
  proyecto: string
  cliente: string
  ruc_empresa: string
  contacto: string
  telefono: string
  elaborado_por: string
  revisado_por: string
  ubicacion: string
  fecha: string
  plazo_ejecucion: string
  moneda: string
  partidas: Partida[]
  subtotal: number
  igv: number
  total: number
  condiciones_comerciales: string[]
  responsabilidades: string[]
  facilidades: string[]
  validez_dias: number | null
  forma_pago: string | null
  estado: string
  created_at?: string
  _hoja?: string
}

interface ListItem {
  id: string
  numero_cot: string
  revision: string
  proyecto: string
  cliente: string
  fecha: string
  total: number
  estado: string
  created_at: string
}

interface ObraRecord {
  id: string
  nombre: string
  estado: string
  codigo?: string
}

interface Props {
  cotizaciones: ListItem[]
  empresaId: string
  dbExists: boolean
  obras: ObraRecord[]
  dbObraExists: boolean
}

const SQL_OBRA = `
CREATE TABLE obra (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  estado      text NOT NULL DEFAULT 'activo',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY obra_empresa ON obra
  USING (empresa_id = get_empresa_id());
`.trim()

const SQL_COTIZACION = `
CREATE TABLE cotizacion (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  numero_cot             text NOT NULL,
  revision               text NOT NULL DEFAULT '1.00',
  proyecto               text NOT NULL,
  cliente                text,
  ruc_empresa            text,
  contacto               text,
  telefono               text,
  elaborado_por          text,
  revisado_por           text,
  ubicacion              text,
  fecha                  date,
  plazo_ejecucion        text,
  moneda                 text NOT NULL DEFAULT 'PEN',
  partidas               jsonb NOT NULL DEFAULT '[]',
  subtotal               numeric(14,2) NOT NULL DEFAULT 0,
  igv                    numeric(14,2) NOT NULL DEFAULT 0,
  total                  numeric(14,2) NOT NULL DEFAULT 0,
  condiciones_comerciales jsonb NOT NULL DEFAULT '[]',
  responsabilidades      jsonb NOT NULL DEFAULT '[]',
  facilidades            jsonb NOT NULL DEFAULT '[]',
  validez_dias           int,
  forma_pago             text,
  estado                 text NOT NULL DEFAULT 'borrador',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cotizacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY cotizacion_empresa ON cotizacion
  USING (empresa_id = get_empresa_id());
`.trim()

const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  borrador:  { bg: '#F1F5F9', color: '#64748B' },
  enviada:   { bg: '#DBEAFE', color: '#1D4ED8' },
  aprobada:  { bg: '#DCFCE7', color: '#15803D' },
  rechazada: { bg: '#FEE2E2', color: '#DC2626' },
}

const EMPTY_COT: Cotizacion = {
  numero_cot: '', revision: '1.00', proyecto: '', cliente: '',
  ruc_empresa: '', contacto: '', telefono: '',
  elaborado_por: '', revisado_por: '', ubicacion: '',
  fecha: new Date().toISOString().split('T')[0],
  plazo_ejecucion: '', moneda: 'PEN',
  partidas: [], subtotal: 0, igv: 0, total: 0,
  condiciones_comerciales: [], responsabilidades: [],
  facilidades: [], validez_dias: 15, forma_pago: null,
  estado: 'borrador',
}

function toIsoDate(val: string | null | undefined): string | null {
  if (!val) return null
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return val
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// ── Selector de proyecto ──────────────────────────────────────────────────────
function ObraField({
  value, onChange, obras, hasError = false,
}: {
  value: string
  onChange: (v: string) => void
  obras: string[]
  hasError?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const id = 'obras-list'

  if (!editando && value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          padding: '5px 10px', borderRadius: 6, background: '#EFF6FF',
          color: '#1D4ED8', fontSize: 12, fontWeight: 600, flex: 1,
        }}>{value}</span>
        <button onClick={() => setEditando(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 13 }}
          title="Cambiar proyecto">✎</button>
        <button onClick={() => { onChange(''); setEditando(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 13 }}
          title="Quitar proyecto">×</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <datalist id={id}>
        {obras.map(o => <option key={o} value={o} />)}
      </datalist>
      <input
        autoFocus
        list={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (value) setEditando(false) }}
        placeholder="Nueva obra o selecciona una existente..."
        style={{
          flex: 1, padding: '7px 10px', borderRadius: 7,
          border: `1px solid ${hasError ? '#FCA5A5' : '#93C5FD'}`,
          fontSize: 12, boxSizing: 'border-box', outline: 'none',
          background: hasError ? '#FEF2F2' : '#fff',
        }}
      />
      {value && (
        <button onClick={() => setEditando(false)}
          style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: '#1E293B', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          OK
        </button>
      )}
    </div>
  )
}

// ── Vista previa tipo documento ───────────────────────────────────────────────
function VistaPrevia({ cot }: { cot: Cotizacion }) {
  return (
    <div style={{ background: '#fff', padding: '32px 40px', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui', fontSize: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #1E293B' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>PRESUPUESTO</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Nº {cot.numero_cot} · Rev. {cot.revision}</div>
          {cot.proyecto && <div style={{ marginTop: 8, fontSize: 12, color: '#334155' }}><b>Proyecto:</b> {cot.proyecto}</div>}
          {cot.cliente   && <div style={{ fontSize: 12, color: '#334155' }}><b>Cliente:</b> {cot.cliente}</div>}
          {cot.ubicacion && <div style={{ fontSize: 12, color: '#334155' }}><b>Ubicación:</b> {cot.ubicacion}</div>}
          {cot.plazo_ejecucion && <div style={{ fontSize: 12, color: '#334155' }}><b>Plazo:</b> {cot.plazo_ejecucion}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {cot.ruc_empresa   && <div><b>RUC:</b> {cot.ruc_empresa}</div>}
          {cot.contacto      && <div><b>Contacto:</b> {cot.contacto}</div>}
          {cot.telefono      && <div><b>Tlf.:</b> {cot.telefono}</div>}
          {cot.elaborado_por && <div><b>Elaborado:</b> {cot.elaborado_por}</div>}
          {cot.revisado_por  && <div><b>Revisado:</b> {cot.revisado_por}</div>}
          {cot.fecha         && <div><b>Fecha:</b> {cot.fecha}</div>}
          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: '#15803D' }}>
            Precio c/IGV: {fmt(cot.total)}
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#1E293B', color: '#fff' }}>
            {['ITEM', 'DESCRIPCIÓN', 'UNID', 'MET.', 'PRECIO', 'PARCIAL'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: h === 'DESCRIPCIÓN' ? 'left' : 'right', fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cot.partidas.map((p, i) => (
            <tr key={i} style={{ background: p.es_titulo ? '#F1F5F9' : i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '5px 8px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{p.item}</td>
              <td style={{ padding: '5px 8px', fontWeight: p.es_titulo ? 700 : 400, color: p.es_titulo ? '#1E293B' : '#334155' }}>{p.descripcion}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#64748B' }}>{p.unidad ?? ''}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#64748B' }}>{p.metrado ?? ''}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#64748B' }}>{p.precio_unitario != null ? `S/ ${p.precio_unitario.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: p.es_titulo ? 700 : 400, color: '#1E293B' }}>
                {p.parcial != null ? `S/ ${p.parcial.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 280 }}>
          <tbody>
          {[
            { label: 'SUB TOTAL', valor: cot.subtotal },
            { label: 'IGV (18%)', valor: cot.igv },
            { label: 'TOTAL', valor: cot.total, bold: true },
          ].map(r => (
            <tr key={r.label}>
              <td style={{ padding: '4px 16px', color: '#64748B', fontSize: 12, textAlign: 'right' }}>{r.label}</td>
              <td style={{ padding: '4px 16px', fontWeight: r.bold ? 800 : 400, fontSize: r.bold ? 14 : 12, color: r.bold ? '#15803D' : '#1E293B', textAlign: 'right', borderTop: r.bold ? '2px solid #1E293B' : 'none' }}>
                {fmt(r.valor)}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {cot.condiciones_comerciales.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 6, fontSize: 12 }}>CONDICIONES COMERCIALES</div>
          {cot.condiciones_comerciales.map((c, i) => <div key={i} style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>{c}</div>)}
        </div>
      )}
      {cot.facilidades.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 6, fontSize: 12 }}>FACILIDADES DEL SERVICIO</div>
          {cot.facilidades.map((c, i) => <div key={i} style={{ color: '#475569', fontSize: 11, marginBottom: 2 }}>{c}</div>)}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: 'center', color: '#94A3B8', fontSize: 11 }}>Atentamente,</div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GestorCotizacionesV2({ cotizaciones: inicial, empresaId, dbExists, obras: obrasIniciales, dbObraExists }: Props) {
  const [lista, setLista]               = useState<ListItem[]>(inicial)
  const [obras, setObras]               = useState<ObraRecord[]>(obrasIniciales)
  const [vista, setVista]               = useState<'lista' | 'nueva' | 'revision'>('lista')
  const [cotActual, setCotActual]        = useState<Cotizacion | null>(null)
  const [cotsParsed, setCotsParsed]      = useState<Cotizacion[]>([])
  const [seleccion, setSeleccion]        = useState<Set<number>>(new Set())
  const [tab, setTab]                    = useState<'form' | 'preview'>('form')
  const [parsing, setParsing]            = useState(false)
  const [parseError, setParseError]      = useState('')
  const [parseWarning, setParseWarning]  = useState('')
  const [proyectoWarning, setProyectoWarning] = useState(false)
  const [proyectoError, setProyectoError]     = useState('')
  const [saving, setSaving]              = useState(false)
  const [dragging, setDragging]          = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const obrasExistentes = obras.map(o => o.nombre)

  async function parsearArchivo(file: File) {
    setParsing(true)
    setParseError('')
    setParseWarning('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch('/api/cotizacion-parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al parsear')

      const cots: Cotizacion[] = (data.cotizaciones as any[]).map(c => ({
        ...EMPTY_COT, ...c, estado: 'borrador',
      }))

      // Avisar hojas con error
      if (data.errores && Object.keys(data.errores).length > 0) {
        const hojasConError = Object.keys(data.errores).join(', ')
        setParseWarning(`Hojas con error (se omitieron): ${hojasConError}`)
      }

      if (cots.length === 1) {
        setCotActual(cots[0])
        setVista('nueva')
        setTab('form')
        setProyectoWarning(!cots[0].proyecto)
      } else {
        setCotsParsed(cots)
        setSeleccion(new Set(cots.map((_, i) => i)))
        setVista('revision')
      }
    } catch (e: any) {
      setParseError(e.message)
    } finally {
      setParsing(false)
    }
  }

  function buildPayload(cot: Cotizacion) {
    return {
      empresa_id: empresaId,
      numero_cot: cot.numero_cot,
      revision:   cot.revision,
      proyecto:   cot.proyecto,
      cliente:    cot.cliente,
      ruc_empresa: cot.ruc_empresa,
      contacto:   cot.contacto,
      telefono:   cot.telefono,
      elaborado_por: cot.elaborado_por,
      revisado_por:  cot.revisado_por,
      ubicacion:  cot.ubicacion,
      fecha:      toIsoDate(cot.fecha),
      plazo_ejecucion: cot.plazo_ejecucion,
      moneda:     cot.moneda,
      partidas:   cot.partidas,
      subtotal:   cot.subtotal,
      igv:        cot.igv,
      total:      cot.total,
      condiciones_comerciales: cot.condiciones_comerciales,
      responsabilidades: cot.responsabilidades,
      facilidades: cot.facilidades,
      validez_dias: cot.validez_dias,
      forma_pago:  cot.forma_pago,
      estado:      cot.estado,
    }
  }

  async function guardar() {
    if (!cotActual) return

    // Validar obra obligatoria
    if (!cotActual.proyecto.trim()) {
      setProyectoError('La obra es obligatoria. Selecciona una existente o escribe el nombre de una nueva.')
      setProyectoWarning(true)
      return
    }

    // Bloquear aprobación sin obra
    if (cotActual.estado === 'aprobada' && !cotActual.proyecto.trim()) {
      setProyectoError('Debes asignar una obra antes de aprobar la cotización.')
      return
    }

    setProyectoError('')
    setSaving(true)

    // Si se aprueba → crear obra en tabla proyecto si no existe
    if (cotActual.estado === 'aprobada' && dbObraExists) {
      const nombreObra = cotActual.proyecto.trim()
      const existe = obras.find(o => o.nombre.toLowerCase() === nombreObra.toLowerCase())
      if (!existe) {
        const { data: nuevaObra, error: errObra } = await supabase
          .from('proyecto')
          .insert({
            empresa_id:           empresaId,
            nombre:               nombreObra,
            cliente:              cotActual.cliente || '',
            tipo:                 'privado',
            estado:               'activo',
            presupuesto_contrato: cotActual.total ?? 0,
            avance_fisico:        0,
          })
          .select('id, nombre, estado, codigo')
          .single()
        if (!errObra && nuevaObra) {
          setObras(prev => [...prev, nuevaObra])
        }
      }
    }

    const payload = buildPayload(cotActual)
    const { data, error } = cotActual.id
      ? await supabase.from('cotizacion').update(payload).eq('id', cotActual.id).select().single()
      : await supabase.from('cotizacion').insert(payload).select().single()

    if (error) { alert(error.message); setSaving(false); return }

    setCotActual(prev => ({ ...prev!, id: data.id }))
    setLista(prev => {
      const exists = prev.find(c => c.id === data.id)
      const item: ListItem = {
        id: data.id, numero_cot: data.numero_cot, revision: data.revision,
        proyecto: data.proyecto, cliente: data.cliente, fecha: data.fecha,
        total: data.total, estado: data.estado, created_at: data.created_at,
      }
      return exists ? prev.map(c => c.id === data.id ? item : c) : [item, ...prev]
    })
    setSaving(false)
    setCotsParsed([])
    setSeleccion(new Set())
    setVista('lista')
  }

  async function guardarSeleccionadas() {
    setSaving(true)
    const aGuardar = cotsParsed.filter((_, i) => seleccion.has(i))
    const errores: string[] = []

    for (const cot of aGuardar) {
      const { data, error } = await supabase
        .from('cotizacion').insert(buildPayload(cot)).select().single()
      if (error) {
        errores.push(`${cot.numero_cot}: ${error.message}`)
        continue
      }
      const item: ListItem = {
        id: data.id, numero_cot: data.numero_cot, revision: data.revision,
        proyecto: data.proyecto, cliente: data.cliente, fecha: data.fecha,
        total: data.total, estado: data.estado, created_at: data.created_at,
      }
      setLista(prev => [item, ...prev])
    }

    setSaving(false)
    // Limpiar parsed para que "Volver" no regrese a revisión y duplique
    setCotsParsed([])
    setSeleccion(new Set())
    if (errores.length) alert('Errores al guardar:\n' + errores.join('\n'))
    setVista('lista')
  }

  function set(field: keyof Cotizacion, value: any) {
    setCotActual(prev => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (field === 'subtotal' || field === 'igv') {
        next.total = (next.subtotal ?? 0) + (next.igv ?? 0)
      }
      return next
    })
  }

  function updateParsed(idx: number, field: keyof Cotizacion, value: any) {
    setCotsParsed(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  // ── DB no existe ──────────────────────────────────────────────────────────
  if (!dbExists) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #E2E8F0', maxWidth: 640 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>Tabla requerida: cotizacion</div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Ejecuta este SQL en Supabase:</div>
          <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 16, fontSize: 11, color: '#334155', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {SQL_COTIZACION}
          </pre>
        </div>
      </div>
    )
  }

  // ── Vista revisión (múltiples hojas) ─────────────────────────────────────
  if (vista === 'revision') {
    const todas = seleccion.size === cotsParsed.length
    return (
      <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setVista('lista')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13 }}>
            ← Volver
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>Revisión de cotizaciones</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {cotsParsed.length} cotizaciones encontradas · {seleccion.size} seleccionadas para guardar
            </div>
          </div>
          <button
            onClick={() => setSeleccion(todas ? new Set() : new Set(cotsParsed.map((_, i) => i)))}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            {todas ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          <button
            onClick={guardarSeleccionadas}
            disabled={saving || seleccion.size === 0}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: seleccion.size === 0 ? '#94A3B8' : '#1E293B', color: '#fff', fontSize: 13, fontWeight: 600, cursor: seleccion.size === 0 ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Guardando...' : `Guardar ${seleccion.size} cotización${seleccion.size !== 1 ? 'es' : ''}`}
          </button>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cotsParsed.map((cot, i) => {
            const sel = seleccion.has(i)
            return (
              <div key={i} style={{
                background: '#fff', borderRadius: 12, border: `2px solid ${sel ? '#3B82F6' : '#E2E8F0'}`,
                padding: 20, transition: 'border-color .15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={sel}
                    onChange={e => {
                      const s = new Set(seleccion)
                      e.target.checked ? s.add(i) : s.delete(i)
                      setSeleccion(s)
                    }}
                    style={{ marginTop: 4, width: 16, height: 16, cursor: 'pointer', accentColor: '#3B82F6' }}
                  />

                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    {/* N° Cot + hoja */}
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>
                        N° Cotización {cot._hoja ? `· Hoja: ${cot._hoja}` : ''}
                      </div>
                      <input
                        value={cot.numero_cot}
                        onChange={e => updateParsed(i, 'numero_cot', e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, boxSizing: 'border-box', fontWeight: 700 }}
                      />
                    </div>

                    {/* Obra */}
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .5 }}>
                        Obra <span style={{ color: '#EF4444' }}>*</span>
                      </div>
                      <ObraField
                        value={cot.proyecto}
                        onChange={v => updateParsed(i, 'proyecto', v)}
                        obras={obrasExistentes}
                        hasError={!cot.proyecto}
                      />
                    </div>

                    {/* Cliente + Total */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, color: '#334155' }}>
                        <b>Cliente:</b> {cot.cliente || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#334155' }}>
                        <b>Fecha:</b> {cot.fecha || '—'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                        {fmt(cot.total)}
                      </div>
                    </div>
                  </div>

                  {/* Abrir para editar completo */}
                  <button
                    onClick={() => { setCotActual({ ...cot }); setVista('nueva'); setTab('form') }}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Editar detalle
                  </button>
                </div>

                {/* Resumen partidas */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#64748B' }}>
                  {cot.partidas.length} partidas
                  {cot.partidas.slice(0, 3).map((p, j) => (
                    <span key={j} style={{ marginLeft: 8, background: '#F1F5F9', padding: '2px 8px', borderRadius: 10 }}>
                      {p.item} {p.descripcion.slice(0, 30)}
                    </span>
                  ))}
                  {cot.partidas.length > 3 && <span style={{ marginLeft: 6, color: '#94A3B8' }}>+{cot.partidas.length - 3} más</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Lista ────────────────────────────────────────────────────────────────
  if (vista === 'lista') {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Cotizaciones</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{lista.length} cotizaciones registradas</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parsearArchivo(f) }}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '8px 18px', borderRadius: 8,
                border: `2px dashed ${dragging ? '#3B82F6' : '#CBD5E1'}`,
                background: dragging ? '#EFF6FF' : '#F8FAFC',
                fontSize: 13, cursor: parsing ? 'not-allowed' : 'pointer',
                color: '#475569', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all .2s',
              }}
            >
              {parsing ? '⏳ Analizando hojas...' : '🤖 Subir Excel/CSV'}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) parsearArchivo(f) }} />
            <button
              onClick={() => { setCotActual({ ...EMPTY_COT }); setVista('nueva'); setTab('form') }}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1E293B', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Nueva cotización
            </button>
          </div>
        </div>

        {parseError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 12, marginBottom: 16 }}>
            {parseError}
          </div>
        )}
        {parseWarning && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', color: '#92400E', fontSize: 12, marginBottom: 16 }}>
            ⚠️ {parseWarning}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {lista.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              Sube un Excel/CSV o crea una cotización manualmente
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['N° COT', 'Proyecto', 'Cliente', 'Fecha', 'Total', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(c => {
                  const ec = ESTADO_COLOR[c.estado] ?? ESTADO_COLOR.borrador
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1E293B' }}>{c.numero_cot}</td>
                      <td style={{ padding: '10px 14px', color: '#334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.proyecto}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{c.cliente}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{c.fecha}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#15803D' }}>{fmt(c.total)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: ec.bg, color: ec.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                          {c.estado}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                        <button
                          onClick={async () => {
                            const { data } = await supabase.from('cotizacion').select('*').eq('id', c.id).single()
                            if (data) { setCotActual(data); setVista('nueva'); setTab('preview') }
                          }}
                          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, cursor: 'pointer' }}
                        >
                          Ver
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar cotización ${c.numero_cot}?`)) return
                            const { error } = await supabase.from('cotizacion').delete().eq('id', c.id)
                            if (error) { alert(error.message); return }
                            setLista(prev => prev.filter(x => x.id !== c.id))
                          }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 11, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ── Editor / Vista previa ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => setVista(cotsParsed.length > 1 ? 'revision' : 'lista')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
          {cotActual?.numero_cot || 'Nueva cotización'}
          {cotActual?.proyecto && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>{cotActual.proyecto}</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          {(['form', 'preview'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#1E293B' : '#64748B',
              fontSize: 12, fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}>
              {t === 'form' ? '✎ Editar' : '👁 Vista previa'}
            </button>
          ))}
        </div>
        <select
          value={cotActual?.estado ?? 'borrador'}
          onChange={e => {
            if (e.target.value === 'aprobada' && !cotActual?.proyecto?.trim()) {
              setProyectoError('Debes asignar una obra antes de aprobar la cotización.')
              setProyectoWarning(true)
              return
            }
            setProyectoError('')
            set('estado', e.target.value)
          }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
        >
          {['borrador', 'enviada', 'aprobada', 'rechazada'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button onClick={guardar} disabled={saving}
          style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#1E293B', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: tab === 'preview' ? 0 : 24 }}>
        {tab === 'preview' && cotActual && <VistaPrevia cot={cotActual} />}

        {tab === 'form' && cotActual && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1000 }}>

            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Información general</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'N° Cotización', field: 'numero_cot' as const },
                  { label: 'Revisión',      field: 'revision'   as const },
                  { label: 'Cliente',       field: 'cliente'    as const },
                  { label: 'Ubicación',     field: 'ubicacion'  as const },
                  { label: 'Fecha',         field: 'fecha'      as const },
                  { label: 'Plazo ejecución', field: 'plazo_ejecucion' as const },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                    <input value={(cotActual as any)[field] ?? ''} onChange={e => set(field, e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                ))}
                {/* Proyecto con autocomplete */}
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>
                    Obra <span style={{ color: '#EF4444' }}>*</span>
                  </div>

                  {/* Banner: no se detectó obra en el Excel */}
                  {proyectoWarning && !cotActual.proyecto && (
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', marginBottom: 4 }}>
                        ⚠ No se detectó obra en el Excel
                      </div>
                      <div style={{ fontSize: 11, color: '#9A3412' }}>
                        Selecciona una obra existente o escribe el nombre de una nueva para crearla al aprobar.
                      </div>
                    </div>
                  )}

                  <ObraField
                    value={cotActual.proyecto}
                    onChange={v => { set('proyecto', v); if (v) { setProyectoWarning(false); setProyectoError('') } }}
                    obras={obrasExistentes}
                    hasError={proyectoWarning && !cotActual.proyecto}
                  />

                  {/* Error al intentar guardar/aprobar sin obra */}
                  {proyectoError && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✕ {proyectoError}
                    </div>
                  )}

                  {/* Indicador: obra nueva (se creará al aprobar) */}
                  {cotActual.proyecto && !obras.find(o => o.nombre.toLowerCase() === cotActual.proyecto.toLowerCase()) && (
                    <div style={{ marginTop: 5, fontSize: 10, color: '#6366F1', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✦ Obra nueva — se creará automáticamente al aprobar
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Contacto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'RUC empresa',   field: 'ruc_empresa'   as const },
                    { label: 'Contacto',      field: 'contacto'      as const },
                    { label: 'Teléfono',      field: 'telefono'      as const },
                    { label: 'Elaborado por', field: 'elaborado_por' as const },
                    { label: 'Revisado por',  field: 'revisado_por'  as const },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                      <input value={(cotActual as any)[field] ?? ''} onChange={e => set(field, e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#ECFDF5', borderRadius: 12, padding: 20, border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 14 }}>Totales</div>
                {[
                  { label: 'Subtotal', field: 'subtotal' as const },
                  { label: 'IGV (18%)', field: 'igv' as const },
                ].map(({ label, field }) => (
                  <div key={field} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#059669', marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                    <input type="number" value={(cotActual as any)[field] ?? 0} onChange={e => set(field, parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #BBF7D0', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ fontSize: 18, fontWeight: 800, color: '#065F46', marginTop: 8 }}>
                  TOTAL: {fmt(cotActual.total)}
                </div>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>
                Partidas ({cotActual.partidas.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['ITEM', 'DESCRIPCIÓN', 'UNID', 'METRADO', 'PRECIO U.', 'PARCIAL', ''].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748B', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cotActual.partidas.map((p, i) => {
                      const lvl     = p.item ? (p.item.match(/\./g) || []).length : 0
                      const lvlBg   = ['#fff','#F8FAFC','#F1F5F9','#EEF2FF'][Math.min(lvl, 3)]
                      const lvlCol  = ['#1E293B','#334155','#64748B','#94A3B8'][Math.min(lvl, 3)]
                      const indent  = lvl * 16
                      return (
                      <tr key={i} style={{ borderTop: '1px solid #F1F5F9', background: lvlBg }}>
                        <td style={{ padding: '5px 8px' }}>
                          <input value={p.item} onChange={e => { const ps = [...cotActual.partidas]; ps[i] = { ...ps[i], item: e.target.value }; set('partidas', ps) }}
                            style={{ width: 70, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 11 }} />
                        </td>
                        <td style={{ paddingLeft: indent + 6, paddingTop: 5, paddingBottom: 5, paddingRight: 8 }}>
                          <input value={p.descripcion} onChange={e => { const ps = [...cotActual.partidas]; ps[i] = { ...ps[i], descripcion: e.target.value }; set('partidas', ps) }}
                            style={{ width: '100%', minWidth: 200, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 11, fontWeight: p.es_titulo ? 700 : 400, color: lvlCol }} />
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <input value={p.unidad ?? ''} onChange={e => { const ps = [...cotActual.partidas]; ps[i] = { ...ps[i], unidad: e.target.value }; set('partidas', ps) }}
                            style={{ width: 50, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 11 }} />
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <input type="number" value={p.metrado ?? ''} onChange={e => { const ps = [...cotActual.partidas]; ps[i] = { ...ps[i], metrado: parseFloat(e.target.value) || null }; set('partidas', ps) }}
                            style={{ width: 70, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 11 }} />
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <input type="number" value={p.precio_unitario ?? ''} onChange={e => { const ps = [...cotActual.partidas]; ps[i] = { ...ps[i], precio_unitario: parseFloat(e.target.value) || null }; set('partidas', ps) }}
                            style={{ width: 80, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 4, fontSize: 11 }} />
                        </td>
                        <td style={{ padding: '5px 8px', fontWeight: 600, color: '#15803D' }}>
                          {p.parcial != null ? `S/ ${p.parcial.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <button onClick={() => { const ps = cotActual.partidas.filter((_, j) => j !== i); set('partidas', ps) }}
                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14 }}>×</button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => set('partidas', [...cotActual.partidas, { item: '', descripcion: '', unidad: null, metrado: null, precio_unitario: null, parcial: null, es_titulo: false }])}
                style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: '1px dashed #CBD5E1', background: '#F8FAFC', fontSize: 12, cursor: 'pointer', color: '#475569' }}
              >
                + Agregar partida
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
