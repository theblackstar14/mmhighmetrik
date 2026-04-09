'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ObraDetalle, PartidaDetalle, CotizacionResumen } from '@/lib/obras'
import CronogramaObra from './CronogramaObra'
import SubirPortada from '../SubirPortada'
import { createClient } from '@/lib/supabase/client'

const RIESGO = {
  ok:      { label: 'Al día',   color: '#059669', bg: '#ECFDF5' },
  medio:   { label: 'Atención', color: '#B45309', bg: '#FFFBEB' },
  alto:    { label: 'Riesgo',   color: '#C2410C', bg: '#FFF7ED' },
  critico: { label: 'Crítico',  color: '#B91C1C', bg: '#FEF2F2' },
}

const CAT_LABELS: Record<string, string> = {
  material: 'Material', subcontrato: 'Subcontrato', mano_obra: 'Mano de obra',
  alquiler: 'Alquiler', administracion: 'Administración', impuesto: 'Impuesto',
}
const CAT_COLORS: Record<string, string> = {
  material: '#2563EB', subcontrato: '#7C3AED', mano_obra: '#059669',
  alquiler: '#D97706', administracion: '#64748B', impuesto: '#DC2626',
}
const ESTADO_FACT: Record<string, { color: string; bg: string }> = {
  pendiente: { color: '#B45309', bg: '#FFFBEB' },
  pagada:    { color: '#059669', bg: '#ECFDF5' },
  vencida:   { color: '#B91C1C', bg: '#FEF2F2' },
  anulada:   { color: '#64748B', bg: '#F8FAFC' },
}
const ESTADO_CERT: Record<string, { color: string; bg: string }> = {
  borrador:   { color: '#64748B', bg: '#F8FAFC' },
  presentada: { color: '#2563EB', bg: '#EFF6FF' },
  aprobada:   { color: '#059669', bg: '#ECFDF5' },
  cobrada:    { color: '#7C3AED', bg: '#F5F3FF' },
}

const TABS = ['Resumen', 'Cronograma', 'Partidas', 'Financiero', 'Contratos', 'Cotizaciones']

const ESTADO_COT: Record<string, { color: string; bg: string }> = {
  borrador:  { color: '#64748B', bg: '#F1F5F9' },
  enviada:   { color: '#1D4ED8', bg: '#DBEAFE' },
  aprobada:  { color: '#15803D', bg: '#DCFCE7' },
  rechazada: { color: '#DC2626', bg: '#FEE2E2' },
}

function fmt(n: number) { return `S/ ${n.toLocaleString()}` }
function fmtFecha(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Celda de partida editable ─────────────────────────────────
type EditKey = 'fecha_inicio' | 'fecha_fin' | 'avance_fisico' | 'responsable'

function CeldaEditable({ partida, campo, valor, onSave }: {
  partida: PartidaDetalle
  campo: EditKey
  valor: string | number | null
  onSave: (id: string, campo: EditKey, valor: string | number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(valor ?? '')
  const [saving, setSaving]   = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  async function commit() {
    setSaving(true)
    const parsed = campo === 'avance_fisico' ? Number(val) : (val === '' ? null : String(val))
    const supabase = createClient()
    await supabase.from('partida').update({ [campo]: parsed }).eq('id', partida.id)
    onSave(partida.id, campo, parsed)
    setSaving(false)
    setEditing(false)
  }

  const display = campo === 'avance_fisico'
    ? `${valor ?? 0}%`
    : campo === 'fecha_inicio' || campo === 'fecha_fin'
      ? (valor ? new Date(String(valor) + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
      : (valor ?? '—')

  if (!editing) return (
    <div
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 30) }}
      title="Clic para editar"
      style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 4, transition: 'background .15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: 11, color: valor ? '#0F172A' : '#CBD5E1' }}>{String(display)}</span>
      <span style={{ marginLeft: 4, fontSize: 9, color: '#CBD5E1' }}>✎</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        ref={inputRef}
        type={campo === 'avance_fisico' ? 'number' : campo.startsWith('fecha') ? 'date' : 'text'}
        value={String(val)}
        min={campo === 'avance_fisico' ? 0 : undefined}
        max={campo === 'avance_fisico' ? 100 : undefined}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        style={{ width: campo === 'avance_fisico' ? 56 : campo.startsWith('fecha') ? 130 : 110, padding: '3px 6px', borderRadius: 5, border: '1.5px solid #2563EB', fontSize: 11, outline: 'none' }}
      />
      {saving && <span style={{ fontSize: 9, color: '#94A3B8' }}>…</span>}
    </div>
  )
}

export default function DetalleObra({ obra: inicial }: { obra: ObraDetalle }) {
  const [tab, setTab]           = useState(0)
  const [imagenUrl, setImagenUrl] = useState(inicial.imagen_url)
  const [hoverPortada, setHoverPortada] = useState(false)
  const [partidas, setPartidas] = useState<PartidaDetalle[]>(inicial.partidas)
  const cotizaciones: CotizacionResumen[] = inicial.cotizaciones
  const obra = { ...inicial, imagen_url: imagenUrl, partidas }

  // ── Nueva partida ─────────────────────────────────────────
  const formVacio = { codigo: '', descripcion: '', unidad: 'glb', metrado: '', precio_unitario: '', responsable: '' }
  const [showForm,      setShowForm]      = useState(false)
  const [formPartida,   setFormPartida]   = useState(formVacio)
  const [savingPartida, setSavingPartida] = useState(false)
  const [errorPartida,  setErrorPartida]  = useState('')

  function setF(k: string, v: string) { setFormPartida(f => ({ ...f, [k]: v })) }

  async function crearPartida() {
    if (!formPartida.codigo || !formPartida.descripcion) {
      setErrorPartida('Código y descripción son requeridos'); return
    }
    setSavingPartida(true); setErrorPartida('')
    const metrado = Number(formPartida.metrado)       || 0
    const pu      = Number(formPartida.precio_unitario) || 0
    const supabase = createClient()
    const { data, error } = await supabase
      .from('partida')
      .insert({
        proyecto_id:     inicial.id,
        codigo:          formPartida.codigo,
        descripcion:     formPartida.descripcion,
        unidad:          formPartida.unidad,
        metrado,
        precio_unitario: pu,
        avance_fisico:   0,
        responsable:     formPartida.responsable || null,
      })
      .select('id,codigo,descripcion,unidad,metrado,precio_unitario,total,avance_fisico,fecha_inicio,fecha_fin,responsable')
      .single()
    setSavingPartida(false)
    if (error) { setErrorPartida(error.message); return }
    // total es columna generada, la DB la devuelve en el select
    setPartidas(prev => [...prev, { ...(data as PartidaDetalle), total: data?.total ?? metrado * pu }])
    setFormPartida(formVacio)
    setShowForm(false)
  }

  function handlePartidaSave(id: string, campo: EditKey, valor: string | number | null) {
    setPartidas(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p))
  }

  const riesgo = RIESGO[obra.nivel_riesgo]

  // Costos por categoría
  const porCategoria = Object.entries(
    obra.costos.reduce<Record<string, number>>((acc, c) => {
      acc[c.categoria] = (acc[c.categoria] ?? 0) + c.monto
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const desvioColor = obra.desvio_tiempo >= 0 ? '#059669' : obra.desvio_tiempo >= -5 ? '#B45309' : '#B91C1C'
  const desvioLabel = obra.desvio_tiempo >= 0 ? `+${obra.desvio_tiempo}pp` : `${obra.desvio_tiempo}pp`

  return (
    <div>
      {/* ── Portada ── */}
      <div
        style={{ position: 'relative', height: 220 }}
        onMouseEnter={() => setHoverPortada(true)}
        onMouseLeave={() => setHoverPortada(false)}
      >
        {imagenUrl ? (
          <Image src={imagenUrl} alt={obra.nombre} fill style={{ objectFit: 'cover' }} unoptimized />
        ) : (
          <div style={{ width: '100%', height: '100%', background: obra.tipo === 'publico' ? 'linear-gradient(135deg,#1E3A5F,#2D5282)' : 'linear-gradient(135deg,#1A1A2E,#16213E)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.25) 60%, transparent 100%)' }} />

        {/* Back */}
        <Link href="/obras" style={{ position: 'absolute', top: 16, left: 20, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', color: '#fff', textDecoration: 'none', fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.2)' }}>
          ← Obras
        </Link>

        {/* Upload button */}
        <div style={{ position: 'absolute', top: 14, right: 16, opacity: hoverPortada ? 1 : 0, transition: 'opacity .2s' }}>
          <SubirPortada proyectoId={obra.id} onUploaded={url => setImagenUrl(url)} />
        </div>

        {/* Info overlay */}
        <div style={{ position: 'absolute', bottom: 18, left: 22, right: 22 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,.5)', color: 'rgba(255,255,255,.85)', backdropFilter: 'blur(4px)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{obra.codigo}</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: obra.tipo === 'publico' ? 'rgba(37,99,235,.7)' : 'rgba(124,58,237,.7)', color: '#fff', backdropFilter: 'blur(4px)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{obra.tipo}</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: riesgo.bg + 'cc', color: riesgo.color, backdropFilter: 'blur(4px)' }}>{riesgo.label}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.4)', lineHeight: 1.2 }}>{obra.nombre}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>{obra.cliente}{obra.ubicacion ? ` · ${obra.ubicacion}` : ''}</div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', overflowX: 'auto' }}>
        {[
          { label: 'Contrato',       val: fmt(obra.presupuesto_contrato),  color: '#2563EB' },
          { label: 'Costo acum.',    val: fmt(obra.costo_acumulado),       color: '#0F172A' },
          { label: 'Margen',         val: `${obra.margen}%`,               color: obra.margen >= 20 ? '#059669' : obra.margen >= 10 ? '#B45309' : '#B91C1C' },
          { label: 'Avance',         val: `${obra.avance_fisico}%`,        color: '#0F172A' },
          { label: 'Desvío tiempo',  val: desvioLabel,                     color: desvioColor },
          { label: obra.atrasado ? 'Días de retraso' : 'Días restantes', val: `${obra.dias_restantes}d`, color: obra.atrasado ? '#B91C1C' : obra.dias_restantes < 30 ? '#B45309' : '#64748B' },
          { label: 'Facturado',      val: fmt(obra.facturado),             color: '#2563EB' },
          { label: 'Cobrado',        val: fmt(obra.cobrado),               color: '#059669' },
        ].map((k, i) => (
          <div key={k.label} style={{ padding: '10px 20px', borderLeft: i > 0 ? '1px solid #F1F5F9' : 'none', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', whiteSpace: 'nowrap' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: k.color, marginTop: 2, whiteSpace: 'nowrap' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '0 22px', gap: 2 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            padding: '11px 16px', fontSize: 12.5, fontWeight: tab === i ? 600 : 400,
            color: tab === i ? '#0F172A' : '#64748B',
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            borderBottom: tab === i ? '2px solid #0F172A' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer', transition: 'color .15s', whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: '22px 26px' }}>

        {/* RESUMEN */}
        {tab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Progress timeline */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Progreso de la obra</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: '#64748B' }}>
                <span>{fmtFecha(obra.fecha_inicio)}</span>
                <span style={{ fontWeight: 600, color: '#EF4444' }}>Hoy {fmtFecha(new Date().toISOString().split('T')[0])}</span>
                <span>{fmtFecha(obra.fecha_fin_contrato)}</span>
              </div>
              {/* Barra avance físico */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10.5, color: '#64748B' }}>
                  <span>Avance físico</span><span style={{ fontWeight: 700, color: '#0F172A' }}>{obra.avance_fisico}%</span>
                </div>
                <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${obra.avance_fisico}%`, background: RIESGO[obra.nivel_riesgo].color, borderRadius: 5 }} />
                </div>
              </div>
              {/* Barra avance esperado */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10.5, color: '#64748B' }}>
                  <span>Avance esperado</span><span style={{ fontWeight: 700, color: '#94A3B8' }}>{obra.avance_esperado}%</span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${obra.avance_esperado}%`, background: '#CBD5E1', borderRadius: 5 }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Últimos costos */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Últimos costos directos</div>
                {obra.costos.slice(0, 6).map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#0F172A' }}>{c.descripcion}</div>
                      <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>{CAT_LABELS[c.categoria] ?? c.categoria} · {fmtFecha(c.fecha)}</div>
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626', flexShrink: 0, marginLeft: 12 }}>−{fmt(c.monto)}</div>
                  </div>
                ))}
                {obra.costos.length === 0 && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Sin costos registrados</div>}
              </div>

              {/* Certificaciones */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Certificaciones</div>
                {obra.certificaciones.map(c => {
                  const st = ESTADO_CERT[c.estado] ?? ESTADO_CERT.borrador
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#0F172A', fontWeight: 600 }}>Cert. N° {c.numero}</div>
                        <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>{c.descripcion ?? fmtFecha(c.fecha)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: st.bg, color: st.color }}>{c.estado}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A' }}>{fmt(c.monto)}</span>
                      </div>
                    </div>
                  )
                })}
                {obra.certificaciones.length === 0 && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Sin certificaciones</div>}
              </div>
            </div>

            {/* Últimas facturas (emitidas y recibidas) */}
            {obra.facturas.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Últimas facturas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                  {obra.facturas.slice(0, 6).map(f => {
                    const st      = ESTADO_FACT[f.estado] ?? ESTADO_FACT.pendiente
                    const emitida = f.tipo === 'emitida'
                    return (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: emitida ? '#EFF6FF' : '#FFF7ED', color: emitida ? '#2563EB' : '#C2410C' }}>
                              {emitida ? 'Emitida' : 'Recibida'}
                            </span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#0F172A' }}>{f.serie_numero}</span>
                          </div>
                          <div style={{ fontSize: 9.5, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.nombre_contraparte ?? '—'} · {fmtFecha(f.fecha_emision)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, marginLeft: 10 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: st.bg, color: st.color }}>{f.estado}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: emitida ? '#059669' : '#DC2626' }}>
                            {emitida ? '+' : '−'}{fmt(f.total)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CRONOGRAMA */}
        {tab === 1 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Cronograma de obra</div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Partidas · fechas · responsables · avance real vs esperado</div>
              </div>
              <button onClick={() => setTab(2)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#2563EB', cursor: 'pointer', fontWeight: 500 }}>
                ✎ Editar fechas y avance →
              </button>
            </div>
            <CronogramaObra
              partidas={partidas}
              fechaIniProyecto={obra.fecha_inicio}
              fechaFinProyecto={obra.fecha_fin_contrato}
            />
          </div>
        )}

        {/* PARTIDAS */}
        {tab === 2 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Presupuesto por partidas</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Clic en ✎ para editar fechas, avance o responsable</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px' }}>Presupuesto total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>{fmt(obra.partidas.reduce((s,p)=>s+(p.total??0),0))}</div>
                </div>
                <button
                  onClick={() => { setShowForm(true); setErrorPartida('') }}
                  style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Nueva partida
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Cód.','Descripción','Unid.','Metrado','P. Unit.','Presupuesto','Inicio ✎','Fin ✎','Avance ✎','Responsable ✎'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 9.5, fontWeight: 600, color: h.includes('✎') ? '#2563EB' : '#64748B', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {obra.partidas.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#94A3B8' }}>{p.codigo}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#0F172A', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748B' }}>{p.unidad}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#0F172A' }}>{Number(p.metrado).toLocaleString()}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#0F172A' }}>S/ {Number(p.precio_unitario).toLocaleString()}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>S/ {Number(p.total ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '6px 8px', minWidth: 120 }}>
                        <CeldaEditable partida={p} campo="fecha_inicio" valor={p.fecha_inicio} onSave={handlePartidaSave} />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 120 }}>
                        <CeldaEditable partida={p} campo="fecha_fin" valor={p.fecha_fin} onSave={handlePartidaSave} />
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 80 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 36, height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ height: '100%', width: `${p.avance_fisico}%`, background: p.avance_fisico >= 100 ? '#94A3B8' : p.avance_fisico >= 70 ? '#10B981' : p.avance_fisico >= 40 ? '#F59E0B' : '#EF4444', borderRadius: 2 }} />
                          </div>
                          <CeldaEditable partida={p} campo="avance_fisico" valor={p.avance_fisico} onSave={handlePartidaSave} />
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', minWidth: 110 }}>
                        <CeldaEditable partida={p} campo="responsable" valor={p.responsable} onSave={handlePartidaSave} />
                      </td>
                    </tr>
                  ))}

                  {/* ── Fila de nueva partida ── */}
                  {showForm && (
                    <tr style={{ background: '#F0F9FF', borderTop: '2px solid #2563EB' }}>
                      <td style={{ padding: '8px 8px' }}>
                        <input value={formPartida.codigo} onChange={e => setF('codigo', e.target.value)}
                          placeholder="1.1.1" style={{ width: 64, padding: '5px 7px', borderRadius: 5, border: '1.5px solid #2563EB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input value={formPartida.descripcion} onChange={e => setF('descripcion', e.target.value)}
                          placeholder="Descripción de la partida" style={{ width: 200, padding: '5px 7px', borderRadius: 5, border: '1.5px solid #2563EB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input value={formPartida.unidad} onChange={e => setF('unidad', e.target.value)}
                          placeholder="m², ml…" style={{ width: 54, padding: '5px 7px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input type="number" value={formPartida.metrado} onChange={e => setF('metrado', e.target.value)}
                          placeholder="0" min="0" style={{ width: 72, padding: '5px 7px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 8px' }}>
                        <input type="number" value={formPartida.precio_unitario} onChange={e => setF('precio_unitario', e.target.value)}
                          placeholder="0.00" min="0" style={{ width: 80, padding: '5px 7px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#2563EB' }}>
                        S/ {((Number(formPartida.metrado) || 0) * (Number(formPartida.precio_unitario) || 0)).toLocaleString()}
                      </td>
                      <td colSpan={3} style={{ padding: '8px 8px' }}>
                        <input value={formPartida.responsable} onChange={e => setF('responsable', e.target.value)}
                          placeholder="Responsable (opcional)" style={{ width: 160, padding: '5px 7px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 11, outline: 'none' }} />
                      </td>
                      <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={crearPartida} disabled={savingPartida}
                          style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: savingPartida ? 'not-allowed' : 'pointer', marginRight: 5 }}>
                          {savingPartida ? '…' : 'Guardar'}
                        </button>
                        <button onClick={() => { setShowForm(false); setFormPartida(formVacio); setErrorPartida('') }}
                          style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer', color: '#64748B' }}>
                          ✕
                        </button>
                        {errorPartida && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 3 }}>{errorPartida}</div>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FINANCIERO */}
        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Facturas emitidas */}
            {(() => {
              const emitidas  = obra.facturas.filter(f => f.tipo === 'emitida')
              const recibidas = obra.facturas.filter(f => f.tipo === 'recibida')

              function tablaFacturas(lista: typeof obra.facturas, titulo: string, colorMonto: string) {
                return (
                  <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
                      {titulo}
                    </div>
                    {lista.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 11, color: '#94A3B8' }}>Sin registros</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            {['Serie/Número','Contraparte','Emisión','Vencimiento','Estado','Total'].map(h => (
                              <th key={h} style={{ padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: '#64748B', textAlign: h === 'Total' ? 'right' : 'left', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map(f => {
                            const st = ESTADO_FACT[f.estado] ?? ESTADO_FACT.pendiente
                            return (
                              <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{f.serie_numero}</td>
                                <td style={{ padding: '9px 14px', fontSize: 11, color: '#64748B', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre_contraparte ?? '—'}</td>
                                <td style={{ padding: '9px 14px', fontSize: 11, color: '#64748B' }}>{fmtFecha(f.fecha_emision)}</td>
                                <td style={{ padding: '9px 14px', fontSize: 11, color: '#64748B' }}>{fmtFecha(f.fecha_vencimiento)}</td>
                                <td style={{ padding: '9px 14px' }}><span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.color }}>{f.estado}</span></td>
                                <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, color: colorMonto, textAlign: 'right' }}>{fmt(f.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              }

              return (
                <>
                  {tablaFacturas(emitidas,  'Facturas emitidas (cobros)',   '#059669')}
                  {tablaFacturas(recibidas, 'Facturas recibidas (pagos)',   '#DC2626')}
                </>
              )
            })()}

            {/* Costos por categoría */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Egresos por categoría</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {porCategoria.map(([cat, total]) => {
                  const pct = obra.costo_acumulado > 0 ? total / obra.costo_acumulado * 100 : 0
                  const color = CAT_COLORS[cat] ?? '#64748B'
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                        <span style={{ color: '#0F172A' }}>{CAT_LABELS[cat] ?? cat}</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{fmt(total)} <span style={{ fontWeight: 400, color: '#94A3B8' }}>({Math.round(pct)}%)</span></span>
                      </div>
                      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
                {porCategoria.length === 0 && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>Sin costos registrados</div>}
              </div>
            </div>

            {/* Flujo proyectado */}
            {obra.flujo.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Flujo proyectado pendiente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {obra.flujo.map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: '#F8FAFC', borderRadius: 7 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#0F172A' }}>{f.descripcion}</div>
                        <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>{fmtFecha(f.fecha_esperada)}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: f.tipo === 'cobro' ? '#2563EB' : '#DC2626' }}>
                        {f.tipo === 'cobro' ? '+' : '−'}{fmt(f.monto)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTRATOS */}
        {tab === 4 && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
              Contratos
            </div>
            {obra.contratos.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 11, color: '#94A3B8' }}>Sin contratos registrados</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Número','Tipo','Firma','Inicio','Fin','Monto','Estado'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 9.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px', textAlign: h === 'Monto' ? 'right' : 'left', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {obra.contratos.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{c.numero}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B', textTransform: 'capitalize' }}>{c.tipo}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B' }}>{fmtFecha(c.fecha_firma)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B' }}>{fmtFecha(c.fecha_inicio)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B' }}>{fmtFecha(c.fecha_fin)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{fmt(c.monto)}</td>
                      <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c.estado === 'vigente' ? '#ECFDF5' : '#F1F5F9', color: c.estado === 'vigente' ? '#059669' : '#64748B' }}>{c.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* COTIZACIONES */}
        {tab === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Cotizaciones vinculadas</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{cotizaciones.length} cotización{cotizaciones.length !== 1 ? 'es' : ''} · la aprobada define el presupuesto y partidas</div>
              </div>
              <Link
                href="/cotizaciones-v2"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, background: '#0F172A', color: '#fff', textDecoration: 'none' }}
              >
                + Nueva cotización
              </Link>
            </div>

            {cotizaciones.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>Sin cotizaciones</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Cuando apruebes una cotización para esta obra aparecerá aquí</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {cotizaciones.map(cot => {
                const st = ESTADO_COT[cot.estado] ?? ESTADO_COT.borrador
                const aprobada = cot.estado === 'aprobada'
                return (
                  <div
                    key={cot.id}
                    style={{
                      background: '#fff',
                      border: `1.5px solid ${aprobada ? '#86EFAC' : '#E2E8F0'}`,
                      borderRadius: 12,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                      boxShadow: aprobada ? '0 0 0 3px #DCFCE7' : undefined,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                          {cot.numero_cot || '—'}
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8', marginLeft: 6 }}>rev. {cot.revision}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                          {cot.fecha ? new Date(cot.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : fmtFecha(cot.created_at)}
                        </div>
                      </div>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        {cot.estado}
                      </span>
                    </div>

                    {/* Monto */}
                    <div style={{ background: aprobada ? '#F0FDF4' : '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 2 }}>Total</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: aprobada ? '#15803D' : '#0F172A' }}>
                        S/ {Number(cot.total ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link
                        href="/cotizaciones-v2"
                        style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', textDecoration: 'none', padding: '5px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#EFF6FF' }}
                      >
                        Ver en cotizaciones →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
