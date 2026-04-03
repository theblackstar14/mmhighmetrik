'use client'
import { useState } from 'react'
import ModalFactura from './ModalFactura'
import ModalGasto   from './ModalGasto'
import TipoCambio   from './TipoCambio'
import type { DatosFacturacion, FacturaRow, GastoRow } from '@/lib/facturacion'

const ESTADO_FACT: Record<string, { color: string; bg: string }> = {
  pendiente: { color: '#B45309', bg: '#FFFBEB' },
  pagada:    { color: '#059669', bg: '#ECFDF5' },
  vencida:   { color: '#B91C1C', bg: '#FEF2F2' },
  anulada:   { color: '#64748B', bg: '#F8FAFC' },
}

const CAT_COLORS: Record<string, string> = {
  material: '#2563EB', subcontrato: '#7C3AED', mano_obra: '#059669',
  alquiler: '#D97706', administracion: '#64748B', impuesto: '#DC2626',
}
const CAT_LABELS: Record<string, string> = {
  material: 'Material', subcontrato: 'Subcontrato', mano_obra: 'Mano de obra',
  alquiler: 'Alquiler / Equipo', administracion: 'Administración', impuesto: 'Impuesto',
}

const CENTRO_LABELS: Record<string, string> = {
  proyecto: 'Proyecto', oficina: 'Oficina', vehiculos: 'Vehículos',
  almacen: 'Almacén', personal: 'Personal', otros: 'Otros',
}
const CENTRO_COLORS: Record<string, string> = {
  proyecto: '#2563EB', oficina: '#7C3AED', vehiculos: '#D97706',
  almacen: '#059669',  personal: '#0891B2', otros: '#64748B',
}

const TABS = ['Emitidas', 'Recibidas', 'Gastos', 'Resumen']

function fmt(n: number, moneda = 'PEN') {
  const prefix = moneda === 'USD' ? '$ ' : 'S/ '
  return prefix + n.toLocaleString('es-PE', { minimumFractionDigits: 2 })
}
function fmtFecha(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  datos:     DatosFacturacion
  empresaId: string
}

export default function GestorFacturacion({ datos, empresaId }: Props) {
  const [tab,         setTab]         = useState(0)
  const [modalFact,   setModalFact]   = useState<{ tipo: 'emitida'|'recibida'; fila?: FacturaRow } | null>(null)
  const [modalGasto,  setModalGasto]  = useState<{ gasto?: GastoRow } | null>(null)
  const [filtroEstado,  setFiltroEstado]  = useState('')
  const [filtroProy,    setFiltroProy]    = useState('')
  const [filtroCentro,  setFiltroCentro]  = useState('')
  const [busqueda,      setBusqueda]      = useState('')

  const { emitidas, recibidas, gastos, proyectos, proveedores, kpis } = datos

  function filtrarFacturas(lista: FacturaRow[]) {
    return lista.filter(f => {
      if (filtroEstado && f.estado !== filtroEstado) return false
      if (filtroProy && f.proyecto_id !== filtroProy) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        return f.serie_numero.toLowerCase().includes(q)
          || (f.nombre_contraparte ?? '').toLowerCase().includes(q)
          || (f.ruc_contraparte ?? '').includes(q)
          || (f.proyecto_nombre ?? '').toLowerCase().includes(q)
      }
      return true
    })
  }

  function filtrarGastos(lista: GastoRow[]) {
    return lista.filter(g => {
      if (filtroCentro && g.centro_costo !== filtroCentro) return false
      if (filtroProy && g.proyecto_id !== filtroProy) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        return g.descripcion.toLowerCase().includes(q)
          || (g.referencia ?? '').toLowerCase().includes(q)
          || (g.comprobante ?? '').toLowerCase().includes(q)
          || (g.proyecto_nombre ?? '').toLowerCase().includes(q)
      }
      return true
    })
  }

  // KPIs del resumen por categoría
  const porCat = Object.entries(
    gastos.reduce<Record<string, number>>((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  return (
    <>
      {/* ── Topbar KPI strip ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', overflowX: 'auto', padding: '0 26px' }}>
        {[
          { label: 'Por cobrar',    val: fmt(kpis.por_cobrar),   color: '#2563EB',   warn: false },
          { label: 'Cob. vencidas', val: kpis.vencidas_cobro,    color: kpis.vencidas_cobro > 0 ? '#B91C1C' : '#059669', warn: kpis.vencidas_cobro > 0 },
          { label: 'Cobrado mes',   val: fmt(kpis.cobrado_mes),  color: '#059669',   warn: false },
          { label: 'Por pagar',     val: fmt(kpis.por_pagar),    color: '#DC2626',   warn: false },
          { label: 'Pag. vencidas', val: kpis.vencidas_pago,     color: kpis.vencidas_pago > 0 ? '#B91C1C' : '#059669', warn: kpis.vencidas_pago > 0 },
          { label: 'Gastado mes',   val: fmt(kpis.gastado_mes),  color: '#0F172A',   warn: false },
        ].map((k, i) => (
          <div key={k.label} style={{ padding: '10px 20px', borderLeft: i > 0 ? '1px solid #F1F5F9' : 'none', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px', whiteSpace: 'nowrap' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: k.color, marginTop: 2, whiteSpace: 'nowrap' }}>{k.val}</div>
          </div>
        ))}
        {/* TC compacto al final */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0 }}>
          <TipoCambio compact />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '0 26px', gap: 2 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setFiltroEstado(''); setFiltroProy(''); setFiltroCentro(''); setBusqueda('') }} style={{
            padding: '11px 16px', fontSize: 12.5, fontWeight: tab === i ? 600 : 400,
            color: tab === i ? '#0F172A' : '#64748B',
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            borderBottom: tab === i ? '2px solid #0F172A' : '2px solid transparent',
            background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .15s',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ──────────────── EMITIDAS ──────────────── */}
        {(tab === 0 || tab === 1) && (() => {
          const esFact = tab === 0
          const lista  = filtrarFacturas(esFact ? emitidas : recibidas)
          const tipo   = esFact ? 'emitida' : 'recibida' as const
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar serie, nombre, RUC…"
                  style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, width: 220, outline: 'none' }} />
                <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                  style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, outline: 'none', color: '#0F172A' }}>
                  <option value="">Todos los estados</option>
                  {['pendiente','pagada','vencida','anulada'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
                </select>
                <select value={filtroProy} onChange={e => setFiltroProy(e.target.value)}
                  style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, outline: 'none', color: '#0F172A', maxWidth: 200 }}>
                  <option value="">Todos los proyectos</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
                </select>
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={() => setModalFact({ tipo })}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0F172A', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    + {esFact ? 'Nueva factura' : 'Registrar recibida'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Serie/Nro.', esFact ? 'Cliente' : 'Proveedor', 'Proyecto', 'Emisión', 'Vencimiento', 'Moneda', 'Total', 'Estado', ''].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: 9.5, fontWeight: 600, color: '#64748B', textAlign: h === 'Total' ? 'right' : 'left', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.length === 0 && (
                        <tr><td colSpan={9} style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>Sin registros</td></tr>
                      )}
                      {lista.map(f => {
                        const st = ESTADO_FACT[f.estado] ?? ESTADO_FACT.pendiente
                        const contraparte = f.nombre_contraparte ?? f.proveedor_nombre ?? f.ruc_contraparte ?? '—'
                        return (
                          <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                            onClick={() => setModalFact({ tipo, fila: f })}>
                            <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{f.serie_numero}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 12, color: '#0F172A', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contraparte}</div>
                              {f.ruc_contraparte && <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.ruc_contraparte}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 11.5, color: '#64748B', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.proyecto_nombre ?? '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtFecha(f.fecha_emision)}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: f.estado === 'vencida' ? '#B91C1C' : '#64748B', whiteSpace: 'nowrap', fontWeight: f.estado === 'vencida' ? 600 : 400 }}>{fmtFecha(f.fecha_vencimiento)}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748B' }}>{f.moneda}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#0F172A', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(f.total, f.moneda)}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{f.estado}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: '#2563EB' }}>Editar</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ──────────────── GASTOS ──────────────── */}
        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar descripción, referencia, proyecto…"
                style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, width: 240, outline: 'none' }} />
              <select value={filtroCentro} onChange={e => setFiltroCentro(e.target.value)}
                style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, outline: 'none', color: '#0F172A' }}>
                <option value="">Todos los centros</option>
                {Object.entries(CENTRO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={filtroProy} onChange={e => setFiltroProy(e.target.value)}
                style={{ padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, outline: 'none', color: '#0F172A', maxWidth: 200 }}>
                <option value="">Todos los proyectos</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
              </select>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={() => setModalGasto({})}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0F172A', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  + Registrar gasto
                </button>
              </div>
            </div>

            {/* Chips resumen por centro */}
            {(() => {
              const totalesCentro = Object.entries(CENTRO_LABELS).map(([val, label]) => {
                const total = gastos.filter(g => g.centro_costo === val).reduce((s, g) => s + g.monto, 0)
                return { val, label, total }
              }).filter(c => c.total > 0)
              if (totalesCentro.length === 0) return null
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {totalesCentro.map(c => (
                    <button key={c.val} type="button"
                      onClick={() => setFiltroCentro(filtroCentro === c.val ? '' : c.val)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${filtroCentro === c.val ? CENTRO_COLORS[c.val] : '#E2E8F0'}`,
                        background: filtroCentro === c.val ? `${CENTRO_COLORS[c.val]}15` : '#F8FAFC',
                        color: filtroCentro === c.val ? CENTRO_COLORS[c.val] : '#64748B',
                        transition: 'all .15s',
                      }}>
                      {c.label} · S/ {c.total.toLocaleString('es-PE', { maximumFractionDigits: 0 })}
                    </button>
                  ))}
                </div>
              )
            })()}

            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Fecha','Centro','Descripción / Referencia','Categoría','Proyecto','Comprobante','Monto',''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: 9.5, fontWeight: 600, color: '#64748B', textAlign: h === 'Monto' ? 'right' : 'left', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrarGastos(gastos).length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>Sin gastos registrados</td></tr>
                    )}
                    {filtrarGastos(gastos).map(g => {
                      const centroColor = CENTRO_COLORS[g.centro_costo] ?? '#64748B'
                      return (
                        <tr key={g.id} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                          onClick={() => setModalGasto({ gasto: g })}>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtFecha(g.fecha)}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${centroColor}15`, color: centroColor, whiteSpace: 'nowrap' }}>
                              {CENTRO_LABELS[g.centro_costo] ?? g.centro_costo}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', maxWidth: 220 }}>
                            <div style={{ fontSize: 12, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.descripcion}</div>
                            {g.referencia && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.referencia}</div>}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${CAT_COLORS[g.categoria] ?? '#64748B'}15`, color: CAT_COLORS[g.categoria] ?? '#64748B' }}>
                              {CAT_LABELS[g.categoria] ?? g.categoria}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#64748B', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.proyecto_nombre ?? '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{g.comprobante ?? '—'}</td>
                          <td style={{ padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: '#DC2626', textAlign: 'right', whiteSpace: 'nowrap' }}>−S/ {g.monto.toLocaleString()}</td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: '#2563EB' }}>Editar</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── RESUMEN ──────────────── */}
        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Total facturado',  val: emitidas.reduce((s,f)=>s+f.total,0),  sub: `${emitidas.length} facturas emitidas`,      color: '#2563EB' },
                { label: 'Total cobrado',    val: emitidas.filter(f=>f.estado==='pagada').reduce((s,f)=>s+f.total,0), sub: 'Facturas en estado pagada', color: '#059669' },
                { label: 'Por cobrar',       val: kpis.por_cobrar,                       sub: `${kpis.vencidas_cobro} vencidas`,            color: kpis.vencidas_cobro > 0 ? '#DC2626' : '#B45309' },
                { label: 'Total recibido',   val: recibidas.reduce((s,f)=>s+f.total,0), sub: `${recibidas.length} facturas recibidas`,    color: '#7C3AED' },
                { label: 'Total pagado',     val: recibidas.filter(f=>f.estado==='pagada').reduce((s,f)=>s+f.total,0), sub: 'Facturas proveedores pagadas', color: '#059669' },
                { label: 'Total gastos',     val: totalGastos,                           sub: `${gastos.length} registros de costo`,        color: '#DC2626' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,23,42,.06)' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.6px' }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color, marginTop: 4 }}>S/ {k.val.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Gastos por centro de costo */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Egresos por centro de costo</div>
              {totalGastos === 0 ? (
                <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Sin datos</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(CENTRO_LABELS).map(([val, label]) => {
                    const total = gastos.filter(g => g.centro_costo === val).reduce((s, g) => s + g.monto, 0)
                    if (total === 0) return null
                    const pct   = totalGastos > 0 ? total / totalGastos * 100 : 0
                    const color = CENTRO_COLORS[val] ?? '#64748B'
                    return (
                      <div key={val}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11.5 }}>
                          <span style={{ color: '#0F172A', fontWeight: 500 }}>{label}</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>S/ {total.toLocaleString()} <span style={{ fontWeight: 400, color: '#94A3B8' }}>({Math.round(pct)}%)</span></span>
                        </div>
                        <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Gastos por categoría */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Egresos por categoría</div>
              {porCat.length === 0 ? (
                <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Sin datos</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {porCat.map(([cat, total]) => {
                    const pct   = totalGastos > 0 ? total / totalGastos * 100 : 0
                    const color = CAT_COLORS[cat] ?? '#64748B'
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11.5 }}>
                          <span style={{ color: '#0F172A', fontWeight: 500 }}>{CAT_LABELS[cat] ?? cat}</span>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>S/ {total.toLocaleString()} <span style={{ fontWeight: 400, color: '#94A3B8' }}>({Math.round(pct)}%)</span></span>
                        </div>
                        <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* TC del día */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Tipo de cambio SUNAT — hoy</div>
              <TipoCambio />
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      {modalFact && (
        <ModalFactura
          tipo={modalFact.tipo}
          factura={modalFact.fila ?? null}
          proyectos={proyectos}
          proveedores={proveedores}
          empresaId={empresaId}
          onClose={() => setModalFact(null)}
        />
      )}
      {modalGasto !== null && (
        <ModalGasto
          proyectos={proyectos}
          gasto={modalGasto.gasto ?? null}
          empresaId={empresaId}
          onClose={() => setModalGasto(null)}
        />
      )}
    </>
  )
}
