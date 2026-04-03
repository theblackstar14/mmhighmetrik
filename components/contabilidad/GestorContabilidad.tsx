'use client'
import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import type {
  DatosReportes, FilaEstadoResultados, FilaIngreso, FilaEgreso,
  FilaCuentaCobrar, FilaObraFinanciero, FilaFlujo, FilaFlujoMes, FilaResumenObra,
} from '@/lib/contabilidad'

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number) {
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2 })
}
function fmtFecha(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMes(s: string) {
  return new Date(s + '-01T00:00:00').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
}

const CAT_LABEL: Record<string, string> = {
  material: 'Materiales', subcontrato: 'Subcontratos', mano_obra: 'Mano de obra',
  alquiler: 'Alquileres', administracion: 'Administración', impuesto: 'Impuestos',
}
const CENTRO_LABEL: Record<string, string> = {
  proyecto: 'Proyecto', oficina: 'Oficina', vehiculos: 'Vehículos',
  almacen: 'Almacén', personal: 'Personal', otros: 'Otros',
}
const MEDIO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', tarjeta: 'Tarjeta',
}
const ESTADO_COLOR: Record<string, { bg: string; color: string }> = {
  emitida:   { bg: '#EFF6FF', color: '#2563EB' },
  pagada:    { bg: '#D1FAE5', color: '#059669' },
  vencida:   { bg: '#FEE2E2', color: '#DC2626' },
  anulada:   { bg: '#F1F5F9', color: '#64748B' },
}

function xlsxDownload(rows: (string | number)[][], filename: string, sheetName = 'Reporte') {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Ancho de columnas automático
  const colWidths = rows[0]?.map((_, ci) =>
    ({ wch: Math.min(50, Math.max(10, ...rows.map(r => String(r[ci] ?? '').length))) })
  )
  if (colWidths) ws['!cols'] = colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

function printSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`
    <html><head><title>Reporte</title><style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #0F172A; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #F8FAFC; padding: 8px 10px; text-align: left; border-bottom: 2px solid #E2E8F0; font-size: 11px; color: #64748B; }
      td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; }
      tfoot td { font-weight: 700; background: #F1F5F9; }
      h2 { font-size: 16px; margin-bottom: 4px; }
      .sub { font-size: 11px; color: #94A3B8; margin-bottom: 20px; }
      .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
      .kpi { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; flex: 1; }
      .kpi-label { font-size: 10px; color: #94A3B8; font-weight: 600; }
      .kpi-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
      @media print { button { display: none; } }
    </style></head><body>
    ${el.innerHTML}
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `)
  w.document.close()
}

// ── Estilos comunes ───────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
  padding: '20px 24px', boxShadow: '0 1px 3px rgba(15,23,42,.05)',
}
const th: React.CSSProperties = {
  padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748B',
  textAlign: 'left', borderBottom: '1.5px solid #E2E8F0', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '9px 12px', fontSize: 12.5, color: '#0F172A',
  borderBottom: '1px solid #F1F5F9',
}
function Btn({ onClick, children, variant = 'outline' }: { onClick: () => void; children: React.ReactNode; variant?: 'dark' | 'outline' | 'green' }) {
  const bg = variant === 'dark' ? '#0F172A' : variant === 'green' ? '#059669' : '#fff'
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: variant === 'outline' ? '1px solid #E2E8F0' : 'none',
      background: bg, color: variant === 'outline' ? '#374151' : '#fff',
    }}>{children}</button>
  )
}
function KpiStrip({ items }: { items: { label: string; valor: string; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
      {items.map(k => (
        <div key={k.label} style={{ ...card, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: k.color ?? '#0F172A' }}>{k.valor}</div>
        </div>
      ))}
    </div>
  )
}

// ── 1. ESTADO DE RESULTADOS ───────────────────────────────────
function ReporteEstadoResultados({ data }: { data: FilaEstadoResultados[] }) {
  const totalIngresos = data.reduce((s, r) => s + r.ingresos, 0)
  const totalEgresos  = data.reduce((s, r) => s + r.egresos,  0)
  const totalUtilidad = totalIngresos - totalEgresos
  const margen        = totalIngresos > 0 ? (totalUtilidad / totalIngresos * 100).toFixed(1) : '0.0'

  function exportar() {
    xlsxDownload([
      ['Mes', 'Ingresos (S/)', 'Egresos (S/)', 'Utilidad (S/)', 'Margen %'],
      ...data.map(r => [
        fmtMes(r.mes),
        r.ingresos,
        r.egresos,
        r.utilidad,
        r.ingresos > 0 ? parseFloat((r.utilidad / r.ingresos * 100).toFixed(1)) : 0,
      ]),
      ['TOTAL', totalIngresos, totalEgresos, totalUtilidad, parseFloat(margen)],
    ], 'estado_resultados', 'Estado de Resultados')
  }

  const maxVal = Math.max(...data.map(r => Math.max(r.ingresos, r.egresos)), 1)

  return (
    <div id="print-estado">
      <KpiStrip items={[
        { label: 'Total ingresos (12m)', valor: fmt(totalIngresos), color: '#059669' },
        { label: 'Total egresos (12m)',  valor: fmt(totalEgresos),  color: '#DC2626' },
        { label: 'Utilidad neta (12m)',  valor: fmt(totalUtilidad), color: totalUtilidad >= 0 ? '#0F172A' : '#DC2626' },
        { label: 'Margen promedio',      valor: margen + '%',       color: parseFloat(margen) >= 0 ? '#0F172A' : '#DC2626' },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Ingresos vs Egresos — últimos 12 meses</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-estado')}>Imprimir / PDF</Btn>
            <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        {/* Gráfico de barras simple */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140, marginBottom: 20, padding: '0 4px' }}>
          {data.map(r => (
            <div key={r.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 120 }}>
                <div title={`Ingresos: ${fmt(r.ingresos)}`} style={{ flex: 1, background: '#10B981', borderRadius: '3px 3px 0 0', height: `${(r.ingresos / maxVal) * 100}%`, minHeight: r.ingresos > 0 ? 2 : 0 }} />
                <div title={`Egresos: ${fmt(r.egresos)}`} style={{ flex: 1, background: '#F87171', borderRadius: '3px 3px 0 0', height: `${(r.egresos / maxVal) * 100}%`, minHeight: r.egresos > 0 ? 2 : 0 }} />
              </div>
              <div style={{ fontSize: 9, color: '#94A3B8', textAlign: 'center' }}>{r.mes.slice(5)}</div>
            </div>
          ))}
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}><div style={{ width: 12, height: 12, borderRadius: 3, background: '#10B981' }} />Ingresos</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}><div style={{ width: 12, height: 12, borderRadius: 3, background: '#F87171' }} />Egresos</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Mes</th>
              <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
              <th style={{ ...th, textAlign: 'right' }}>Egresos</th>
              <th style={{ ...th, textAlign: 'right' }}>Utilidad</th>
              <th style={{ ...th, textAlign: 'right' }}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.mes}>
                <td style={td}>{fmtMes(r.mes)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt(r.ingresos)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#DC2626' }}>{fmt(r.egresos)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.utilidad >= 0 ? '#059669' : '#DC2626' }}>{fmt(r.utilidad)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#64748B' }}>
                  {r.ingresos > 0 ? (r.utilidad / r.ingresos * 100).toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F8FAFC' }}>
              <td style={{ ...td, fontWeight: 700 }}>TOTAL</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(totalIngresos)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{fmt(totalEgresos)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: totalUtilidad >= 0 ? '#059669' : '#DC2626' }}>{fmt(totalUtilidad)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{margen}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── 2. CUENTAS POR COBRAR ─────────────────────────────────────
function ReporteCuentasCobrar({ data }: { data: FilaCuentaCobrar[] }) {
  function bucket(dias: number) {
    if (dias <= 0) return 'corriente'
    if (dias <= 30) return '1-30'
    if (dias <= 60) return '31-60'
    if (dias <= 90) return '61-90'
    return '+90'
  }
  const bucketColor: Record<string, string> = {
    corriente: '#059669', '1-30': '#F59E0B', '31-60': '#F97316', '61-90': '#EF4444', '+90': '#7C2D12',
  }
  const totalPorCobrar = data.reduce((s, f) => s + f.total, 0)
  const totalVencido   = data.filter(f => f.dias_vencida > 0).reduce((s, f) => s + f.total, 0)

  function exportar() {
    xlsxDownload([
      ['Serie', 'Cliente / Contraparte', 'Proyecto', 'Monto (S/)', 'Fecha emisión', 'Fecha vencimiento', 'Días vencida', 'Estado'],
      ...data.map(f => [
        f.serie_numero, f.nombre_contraparte ?? '—', f.proyecto_nombre ?? '—',
        f.total, fmtFecha(f.fecha_emision),
        f.fecha_vencimiento ? fmtFecha(f.fecha_vencimiento) : '—',
        f.dias_vencida > 0 ? f.dias_vencida : 'Por vencer', f.estado,
      ]),
    ], 'cuentas_por_cobrar', 'Cuentas por Cobrar')
  }

  return (
    <div id="print-cobrar">
      <KpiStrip items={[
        { label: 'Total por cobrar',  valor: fmt(totalPorCobrar), color: '#2563EB' },
        { label: 'Vencido',           valor: fmt(totalVencido),   color: totalVencido > 0 ? '#DC2626' : '#059669' },
        { label: 'Corriente',         valor: fmt(totalPorCobrar - totalVencido), color: '#059669' },
        { label: 'N° facturas',       valor: String(data.length) },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Facturas emitidas pendientes de cobro</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-cobrar')}>Imprimir / PDF</Btn>
            <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>Sin facturas pendientes</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Factura</th>
                <th style={th}>Cliente</th>
                <th style={th}>Proyecto</th>
                <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                <th style={th}>Emisión</th>
                <th style={th}>Vencimiento</th>
                <th style={th}>Antigüedad</th>
              </tr>
            </thead>
            <tbody>
              {data.map(f => {
                const b = bucket(f.dias_vencida)
                return (
                  <tr key={f.id}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{f.serie_numero}</span></td>
                    <td style={td}>{f.nombre_contraparte ?? '—'}</td>
                    <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{f.proyecto_nombre ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(f.total)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{fmtFecha(f.fecha_emision)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{f.fecha_vencimiento ? fmtFecha(f.fecha_vencimiento) : '—'}</td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: bucketColor[b] + '18', color: bucketColor[b],
                      }}>
                        {b === 'corriente'
                          ? f.fecha_vencimiento ? `${Math.abs(f.dias_vencida)}d por vencer` : 'Sin fecha'
                          : `${f.dias_vencida}d vencida`}
                      </span>
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

// ── 3. FINANCIERO POR OBRA ────────────────────────────────────
function ReporteObraFinanciero({ data }: { data: FilaObraFinanciero[] }) {
  const [filtro, setFiltro] = useState('todos')
  const visible = filtro === 'todos' ? data : data.filter(o => o.proyecto_id === filtro)

  const totIngresos = visible.reduce((s, o) => s + o.ingresos, 0)
  const totEgresos  = visible.reduce((s, o) => s + o.egresos,  0)
  const totUtilidad = totIngresos - totEgresos

  function exportar() {
    const rows: (string | number)[][] = [
      ['Proyecto', 'Cliente', 'Ingresos (S/)', 'Egresos (S/)', 'Utilidad (S/)', 'Margen %', 'Categoría egreso', 'Total categoría'],
    ]
    for (const o of visible) {
      if (o.egresos_categoria.length === 0) {
        rows.push([o.proyecto_codigo + ' · ' + o.proyecto_nombre, o.cliente, o.ingresos, o.egresos, o.utilidad, o.margen, '—', 0])
      } else {
        o.egresos_categoria.forEach((cat, i) => {
          rows.push([
            i === 0 ? o.proyecto_codigo + ' · ' + o.proyecto_nombre : '',
            i === 0 ? o.cliente : '',
            i === 0 ? o.ingresos : '',
            i === 0 ? o.egresos : '',
            i === 0 ? o.utilidad : '',
            i === 0 ? o.margen : '',
            CAT_LABEL[cat.categoria] ?? cat.categoria,
            cat.total,
          ])
        })
      }
    }
    rows.push(['TOTAL', '', totIngresos, totEgresos, totUtilidad, '', '', ''])
    xlsxDownload(rows, 'financiero_por_obra', 'Por Obra')
  }

  return (
    <div id="print-costos">
      <KpiStrip items={[
        { label: 'Total ingresos',  valor: fmt(totIngresos), color: '#059669' },
        { label: 'Total egresos',   valor: fmt(totEgresos),  color: '#DC2626' },
        { label: 'Utilidad',        valor: fmt(totUtilidad), color: totUtilidad >= 0 ? '#0F172A' : '#DC2626' },
        { label: 'Obras / centros', valor: String(visible.length) },
      ]} />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Ingresos y egresos por obra — últimos 12 meses</span>
          <select value={filtro} onChange={e => setFiltro(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, color: '#374151' }}>
            <option value="todos">Todas</option>
            {data.map(o => <option key={o.proyecto_id} value={o.proyecto_id}>{o.proyecto_codigo} · {o.proyecto_nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => printSection('print-costos')}>Imprimir / PDF</Btn>
          <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>Sin registros</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visible.map(o => (
            <div key={o.proyecto_id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {/* Header obra */}
              <div style={{ padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginRight: 8 }}>{o.proyecto_codigo}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{o.proyecto_nombre}</span>
                  {o.cliente !== 'Interno' && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>· {o.cliente}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {o.presupuesto_contrato > 0 && (
                    <span style={{ fontSize: 11, color: '#64748B' }}>Contrato: {fmt(o.presupuesto_contrato)}</span>
                  )}
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: o.margen >= 15 ? '#D1FAE5' : o.margen >= 0 ? '#FEF9C3' : '#FEE2E2',
                    color: o.margen >= 15 ? '#059669' : o.margen >= 0 ? '#92400E' : '#DC2626',
                  }}>
                    {o.margen > 0 ? '+' : ''}{o.margen}% margen
                  </span>
                </div>
              </div>

              {/* KPIs de la obra */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F1F5F9' }}>
                {[
                  { label: 'Ingresos facturados', valor: fmt(o.ingresos), color: '#059669' },
                  { label: 'Egresos ejecutados',  valor: fmt(o.egresos),  color: '#DC2626' },
                  { label: 'Utilidad bruta',       valor: fmt(o.utilidad), color: o.utilidad >= 0 ? '#0F172A' : '#DC2626' },
                ].map(k => (
                  <div key={k.label} style={{ padding: '12px 20px', borderRight: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 600 }}>{k.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: k.color, marginTop: 2 }}>{k.valor}</div>
                  </div>
                ))}
              </div>

              {/* Barra de utilidad vs egresos */}
              {(o.ingresos > 0 || o.egresos > 0) && (
                <div style={{ padding: '8px 20px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>
                    <span>Egresos vs Ingresos</span>
                    <span>{o.ingresos > 0 ? Math.round(o.egresos / o.ingresos * 100) : 100}%</span>
                  </div>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width .3s',
                      width: `${Math.min(o.ingresos > 0 ? (o.egresos / o.ingresos * 100) : 100, 100)}%`,
                      background: o.egresos <= o.ingresos ? '#10B981' : '#EF4444',
                    }} />
                  </div>
                </div>
              )}

              {/* Desglose de egresos por categoría */}
              {o.egresos_categoria.length > 0 && (
                <div style={{ padding: '10px 20px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>EGRESOS POR CATEGORÍA</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {o.egresos_categoria.map(cat => (
                      <div key={cat.categoria} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 11.5, color: '#374151', fontWeight: 600 }}>{CAT_LABEL[cat.categoria] ?? cat.categoria}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#DC2626' }}>{fmt(cat.total)}</span>
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>
                          {o.egresos > 0 ? (cat.total / o.egresos * 100).toFixed(0) + '%' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── INGRESOS ──────────────────────────────────────────────────
function ReporteIngresos({ data }: { data: FilaIngreso[] }) {
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda]         = useState('')

  const visible = data
    .filter(f => filtroEstado === 'todos' || f.estado === filtroEstado)
    .filter(f => !busqueda || f.serie_numero.toLowerCase().includes(busqueda.toLowerCase())
      || (f.nombre_contraparte ?? '').toLowerCase().includes(busqueda.toLowerCase())
      || (f.proyecto_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()))

  const totalFacturado = data.reduce((s, f) => s + f.total, 0)
  const totalCobrado   = data.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.total, 0)
  const totalPendiente = data.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada').reduce((s, f) => s + f.total, 0)

  function exportar() {
    xlsxDownload([
      ['Factura', 'Cliente', 'Proyecto', 'Monto (S/)', 'Fecha emisión', 'Fecha cobro', 'Estado'],
      ...visible.map(f => [
        f.serie_numero, f.nombre_contraparte ?? '—', f.proyecto_nombre ?? '—',
        f.total, fmtFecha(f.fecha_emision),
        f.fecha_pago ? fmtFecha(f.fecha_pago) : '—', f.estado,
      ]),
    ], 'ingresos', 'Ingresos')
  }

  return (
    <div id="print-ingresos">
      <KpiStrip items={[
        { label: 'Total facturado (12m)', valor: fmt(totalFacturado), color: '#2563EB' },
        { label: 'Cobrado',               valor: fmt(totalCobrado),   color: '#059669' },
        { label: 'Por cobrar',            valor: fmt(totalPendiente), color: '#F59E0B' },
        { label: 'N° facturas',           valor: String(data.length) },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar factura, cliente…"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, width: 200 }} />
            {['todos', 'emitida', 'pagada', 'vencida'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${filtroEstado === e ? '#2563EB' : '#E2E8F0'}`,
                background: filtroEstado === e ? '#EFF6FF' : '#fff',
                color: filtroEstado === e ? '#2563EB' : '#64748B',
              }}>{e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-ingresos')}>Imprimir / PDF</Btn>
            <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>Sin registros</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Factura</th>
                <th style={th}>Cliente / Contraparte</th>
                <th style={th}>Proyecto</th>
                <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                <th style={th}>Emisión</th>
                <th style={th}>Cobro</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(f => {
                const ec = ESTADO_COLOR[f.estado] ?? { bg: '#F1F5F9', color: '#64748B' }
                return (
                  <tr key={f.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.serie_numero}</td>
                    <td style={td}>{f.nombre_contraparte ?? '—'}</td>
                    <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{f.proyecto_nombre ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(f.total)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{fmtFecha(f.fecha_emision)}</td>
                    <td style={{ ...td, fontSize: 12, color: f.fecha_pago ? '#059669' : '#94A3B8' }}>
                      {f.fecha_pago ? fmtFecha(f.fecha_pago) : '—'}
                    </td>
                    <td style={td}>
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: ec.bg, color: ec.color }}>
                        {f.estado}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC' }}>
                <td colSpan={3} style={{ ...td, fontWeight: 700 }}>TOTAL ({visible.length} facturas)</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#059669' }}>{fmt(visible.reduce((s, f) => s + f.total, 0))}</td>
                <td colSpan={3} style={td} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

// ── EGRESOS ───────────────────────────────────────────────────
function ReporteEgresos({ data }: { data: FilaEgreso[] }) {
  const [filtroCentro,   setFiltroCentro]   = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [filtroMedio,    setFiltroMedio]    = useState('todos')
  const [busqueda,       setBusqueda]       = useState('')

  const centros    = [...new Set(data.map(e => e.centro_costo))]
  const categorias = [...new Set(data.map(e => e.categoria))]
  const medios     = [...new Set(data.map(e => e.medio_pago))]

  const visible = data
    .filter(e => filtroCentro    === 'todos' || e.centro_costo === filtroCentro)
    .filter(e => filtroCategoria === 'todos' || e.categoria    === filtroCategoria)
    .filter(e => filtroMedio     === 'todos' || e.medio_pago   === filtroMedio)
    .filter(e => !busqueda || e.descripcion.toLowerCase().includes(busqueda.toLowerCase())
      || (e.proyecto_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()))

  const totalVisible = visible.reduce((s, e) => s + e.monto, 0)
  const totalCaja    = data.filter(e => e.medio_pago === 'efectivo').reduce((s, e) => s + e.monto, 0)
  const totalBanco   = data.filter(e => e.medio_pago !== 'efectivo').reduce((s, e) => s + e.monto, 0)

  function exportar() {
    xlsxDownload([
      ['Fecha', 'Descripción', 'Proyecto / Centro', 'Categoría', 'Medio de pago', 'Comprobante', 'Monto (S/)'],
      ...visible.map(e => [
        fmtFecha(e.fecha), e.descripcion,
        e.proyecto_nombre ?? CENTRO_LABEL[e.centro_costo] ?? e.centro_costo,
        CAT_LABEL[e.categoria] ?? e.categoria,
        MEDIO_LABEL[e.medio_pago] ?? e.medio_pago,
        e.comprobante ?? '—', e.monto,
      ]),
      ['', '', '', '', 'TOTAL', '', totalVisible],
    ], 'egresos', 'Egresos')
  }

  return (
    <div id="print-egresos">
      <KpiStrip items={[
        { label: 'Total egresos (12m)', valor: fmt(data.reduce((s, e) => s + e.monto, 0)), color: '#DC2626' },
        { label: 'Por caja (efectivo)',  valor: fmt(totalCaja),  color: '#F59E0B' },
        { label: 'Por banco',            valor: fmt(totalBanco), color: '#2563EB' },
        { label: 'N° registros',         valor: String(data.length) },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar descripción…"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, width: 180 }} />
            <select value={filtroCentro} onChange={e => setFiltroCentro(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}>
              <option value="todos">Todos los centros</option>
              {centros.map(c => <option key={c} value={c}>{CENTRO_LABEL[c] ?? c}</option>)}
            </select>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}>
              <option value="todos">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>)}
            </select>
            <select value={filtroMedio} onChange={e => setFiltroMedio(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}>
              <option value="todos">Todos los medios</option>
              {medios.map(m => <option key={m} value={m}>{MEDIO_LABEL[m] ?? m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-egresos')}>Imprimir / PDF</Btn>
            <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>Sin registros</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Descripción</th>
                <th style={th}>Centro / Proyecto</th>
                <th style={th}>Categoría</th>
                <th style={th}>Medio</th>
                <th style={th}>Comprobante</th>
                <th style={{ ...th, textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(e => (
                <tr key={e.id}>
                  <td style={{ ...td, fontSize: 12 }}>{fmtFecha(e.fecha)}</td>
                  <td style={td}>{e.descripcion}</td>
                  <td style={{ ...td, fontSize: 12, color: '#64748B' }}>
                    {e.proyecto_nombre ?? CENTRO_LABEL[e.centro_costo] ?? e.centro_costo}
                  </td>
                  <td style={td}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#374151' }}>
                      {CAT_LABEL[e.categoria] ?? e.categoria}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: e.medio_pago === 'efectivo' ? '#FEF9C3' : '#EFF6FF',
                      color:      e.medio_pago === 'efectivo' ? '#92400E' : '#1D4ED8',
                    }}>
                      {MEDIO_LABEL[e.medio_pago] ?? e.medio_pago}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#94A3B8' }}>{e.comprobante ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{fmt(e.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC' }}>
                <td colSpan={6} style={{ ...td, fontWeight: 700 }}>TOTAL ({visible.length} registros)</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#DC2626' }}>{fmt(totalVisible)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

// ── 4. FLUJO DE CAJA ──────────────────────────────────────────
function ReporteFlujo({ flujo30, flujo60, flujo90, flujoMes }: {
  flujo30: FilaFlujo[]; flujo60: FilaFlujo[]; flujo90: FilaFlujo[]
  flujoMes: FilaFlujoMes[]
}) {
  const [vista,      setVista]      = useState<'proyectado' | 'comparativo'>('proyectado')
  const [horizonte,  setHorizonte]  = useState<30 | 60 | 90>(30)
  const data   = horizonte === 30 ? flujo30 : horizonte === 60 ? flujo60 : flujo90
  const cobros = data.filter(f => f.tipo === 'cobro').reduce((s, f) => s + f.monto, 0)
  const pagos  = data.filter(f => f.tipo === 'pago').reduce((s, f) => s + f.monto, 0)

  function exportarProyectado() {
    xlsxDownload([
      ['Tipo', 'Descripción', 'Monto (S/)', 'Fecha esperada', 'Origen'],
      ...data.map(f => [f.tipo === 'cobro' ? 'Cobro' : 'Pago', f.descripcion, f.monto, fmtFecha(f.fecha_esperada), f.origen ?? '—']),
    ], `flujo_proyectado_${horizonte}d`, `Flujo ${horizonte} días`)
  }

  function exportarComparativo() {
    xlsxDownload([
      ['Mes', 'Ingresos real (S/)', 'Egresos real (S/)', 'Flujo real (S/)', 'Cobros proyect. (S/)', 'Pagos proyect. (S/)', 'Flujo proyect. (S/)'],
      ...flujoMes.map(m => [fmtMes(m.mes), m.ingresos_real, m.egresos_real, m.flujo_real, m.cobros_proyectado, m.pagos_proyectado, m.flujo_proyectado]),
    ], 'flujo_real_vs_proyectado', 'Flujo Real vs Proyectado')
  }

  const maxFlujoMes = Math.max(...flujoMes.map(m => Math.max(m.ingresos_real, m.egresos_real, m.cobros_proyectado, m.pagos_proyectado)), 1)

  return (
    <div id="print-flujo">
      {/* Sub-tabs: Proyectado vs Comparativo */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {([['proyectado', 'Flujo proyectado (próximos días)'], ['comparativo', 'Real vs Proyectado (por mes)']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${vista === v ? '#2563EB' : '#E2E8F0'}`,
            background: vista === v ? '#2563EB' : '#fff',
            color: vista === v ? '#fff' : '#64748B',
          }}>{l}</button>
        ))}
      </div>

      {vista === 'comparativo' ? (
        <>
          <KpiStrip items={[
            { label: 'Ingresos reales (12m)',  valor: fmt(flujoMes.reduce((s, m) => s + m.ingresos_real, 0)),      color: '#059669' },
            { label: 'Egresos reales (12m)',   valor: fmt(flujoMes.reduce((s, m) => s + m.egresos_real, 0)),       color: '#DC2626' },
            { label: 'Cobros proyectados',     valor: fmt(flujoMes.reduce((s, m) => s + m.cobros_proyectado, 0)),  color: '#2563EB' },
            { label: 'Pagos proyectados',      valor: fmt(flujoMes.reduce((s, m) => s + m.pagos_proyectado, 0)),   color: '#7C3AED' },
          ]} />
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Flujo real vs proyectado — últimos 12 meses</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={() => printSection('print-flujo')}>Imprimir / PDF</Btn>
                <Btn onClick={exportarComparativo} variant="dark">Exportar Excel</Btn>
              </div>
            </div>

            {/* Gráfico de barras comparativo */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 140, marginBottom: 8 }}>
              {flujoMes.map(m => (
                <div key={m.mes} style={{ flex: 1, display: 'flex', gap: 1, alignItems: 'flex-end', height: 120 }}>
                  <div title={`Ingresos real: ${fmt(m.ingresos_real)}`} style={{ flex: 1, background: '#10B981', borderRadius: '2px 2px 0 0', height: `${(m.ingresos_real / maxFlujoMes) * 100}%`, minHeight: m.ingresos_real > 0 ? 2 : 0 }} />
                  <div title={`Egresos real: ${fmt(m.egresos_real)}`}   style={{ flex: 1, background: '#F87171', borderRadius: '2px 2px 0 0', height: `${(m.egresos_real / maxFlujoMes) * 100}%`, minHeight: m.egresos_real > 0 ? 2 : 0 }} />
                  <div title={`Cobros proyect.: ${fmt(m.cobros_proyectado)}`} style={{ flex: 1, background: '#93C5FD', borderRadius: '2px 2px 0 0', height: `${(m.cobros_proyectado / maxFlujoMes) * 100}%`, minHeight: m.cobros_proyectado > 0 ? 2 : 0 }} />
                  <div title={`Pagos proyect.: ${fmt(m.pagos_proyectado)}`}   style={{ flex: 1, background: '#C4B5FD', borderRadius: '2px 2px 0 0', height: `${(m.pagos_proyectado / maxFlujoMes) * 100}%`, minHeight: m.pagos_proyectado > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10.5, marginBottom: 20, flexWrap: 'wrap' }}>
              {[['#10B981','Ingresos real'],['#F87171','Egresos real'],['#93C5FD','Cobros proyect.'],['#C4B5FD','Pagos proyect.']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#374151' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                </div>
              ))}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Mes</th>
                  <th style={{ ...th, textAlign: 'right', color: '#059669' }}>Ingresos real</th>
                  <th style={{ ...th, textAlign: 'right', color: '#DC2626' }}>Egresos real</th>
                  <th style={{ ...th, textAlign: 'right' }}>Flujo real</th>
                  <th style={{ ...th, textAlign: 'right', color: '#2563EB' }}>Cobros proyect.</th>
                  <th style={{ ...th, textAlign: 'right', color: '#7C3AED' }}>Pagos proyect.</th>
                  <th style={{ ...th, textAlign: 'right' }}>Flujo proyect.</th>
                </tr>
              </thead>
              <tbody>
                {flujoMes.map(m => (
                  <tr key={m.mes}>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtMes(m.mes)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#059669' }}>{fmt(m.ingresos_real)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#DC2626' }}>{fmt(m.egresos_real)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.flujo_real >= 0 ? '#059669' : '#DC2626' }}>{fmt(m.flujo_real)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#2563EB' }}>{m.cobros_proyectado > 0 ? fmt(m.cobros_proyectado) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#7C3AED' }}>{m.pagos_proyectado > 0 ? fmt(m.pagos_proyectado) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.flujo_proyectado >= 0 ? '#059669' : '#DC2626' }}>
                      {m.cobros_proyectado > 0 || m.pagos_proyectado > 0 ? fmt(m.flujo_proyectado) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
      <KpiStrip items={[
        { label: `Cobros proyectados (${horizonte}d)`, valor: fmt(cobros), color: '#059669' },
        { label: `Pagos proyectados (${horizonte}d)`,  valor: fmt(pagos),  color: '#DC2626' },
        { label: 'Flujo neto',                          valor: fmt(cobros - pagos), color: cobros - pagos >= 0 ? '#0F172A' : '#DC2626' },
        { label: 'Movimientos',                         valor: String(data.length) },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Flujo de caja proyectado</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([30, 60, 90] as const).map(h => (
                <button key={h} onClick={() => setHorizonte(h)} style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${horizonte === h ? '#2563EB' : '#E2E8F0'}`,
                  background: horizonte === h ? '#EFF6FF' : '#fff',
                  color: horizonte === h ? '#2563EB' : '#64748B',
                }}>{h} días</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-flujo')}>Imprimir / PDF</Btn>
            <Btn onClick={exportarProyectado} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: 13 }}>Sin movimientos proyectados en este período</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Tipo</th>
                <th style={th}>Descripción</th>
                <th style={th}>Origen</th>
                <th style={{ ...th, textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {data.map(f => (
                <tr key={f.id}>
                  <td style={{ ...td, fontSize: 12 }}>{fmtFecha(f.fecha_esperada)}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: f.tipo === 'cobro' ? '#D1FAE5' : '#FEE2E2',
                      color: f.tipo === 'cobro' ? '#059669' : '#DC2626',
                    }}>
                      {f.tipo === 'cobro' ? 'Cobro' : 'Pago'}
                    </span>
                  </td>
                  <td style={td}>{f.descripcion}</td>
                  <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{f.origen ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: f.tipo === 'cobro' ? '#059669' : '#DC2626' }}>
                    {f.tipo === 'cobro' ? '+' : '-'}{fmt(f.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      )}
    </div>
  )
}

// ── 5. RESUMEN EJECUTIVO ──────────────────────────────────────
function ReporteResumenEjecutivo({ data, totalPorCobrar, totalVencido, totalCostosMes, totalIngresosMes }: {
  data: FilaResumenObra[]
  totalPorCobrar: number; totalVencido: number
  totalCostosMes: number; totalIngresosMes: number
}) {
  function exportar() {
    xlsxDownload([
      ['Código', 'Nombre', 'Cliente', 'Contrato (S/)', 'Costo ejecutado (S/)', 'Margen %', 'Avance físico %', 'Estado'],
      ...data.map(r => [r.codigo, r.nombre, r.cliente, r.presupuesto_contrato, r.costo_ejecutado, r.margen, r.avance_fisico, r.estado]),
    ], 'resumen_ejecutivo', 'Resumen Ejecutivo')
  }

  const utilidadMes = totalIngresosMes - totalCostosMes

  return (
    <div id="print-ejecutivo">
      <KpiStrip items={[
        { label: 'Ingresos este mes',  valor: fmt(totalIngresosMes), color: '#059669' },
        { label: 'Egresos este mes',   valor: fmt(totalCostosMes),   color: '#DC2626' },
        { label: 'Utilidad este mes',  valor: fmt(utilidadMes),      color: utilidadMes >= 0 ? '#0F172A' : '#DC2626' },
        { label: 'Por cobrar total',   valor: fmt(totalPorCobrar),   color: '#2563EB' },
        { label: 'Vencido',            valor: fmt(totalVencido),     color: totalVencido > 0 ? '#EF4444' : '#059669' },
      ]} />

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Rentabilidad por obra</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => printSection('print-ejecutivo')}>Imprimir / PDF</Btn>
            <Btn onClick={exportar} variant="dark">Exportar Excel</Btn>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Código</th>
              <th style={th}>Nombre</th>
              <th style={th}>Cliente</th>
              <th style={{ ...th, textAlign: 'right' }}>Contrato</th>
              <th style={{ ...th, textAlign: 'right' }}>Costo ejecutado</th>
              <th style={{ ...th, textAlign: 'right' }}>Margen</th>
              <th style={{ ...th, textAlign: 'right' }}>Avance</th>
              <th style={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 700, fontSize: 12 }}>{r.codigo}</td>
                <td style={td}>{r.nombre}</td>
                <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{r.cliente}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt(r.presupuesto_contrato)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#DC2626' }}>{fmt(r.costo_ejecutado)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.margen >= 10 ? '#059669' : r.margen >= 0 ? '#F59E0B' : '#DC2626' }}>
                  {r.margen}%
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(r.avance_fisico, 100)}%`, background: '#2563EB', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12 }}>{r.avance_fisico}%</span>
                  </div>
                </td>
                <td style={td}>
                  <span style={{
                    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: r.estado === 'activo' ? '#D1FAE5' : '#F1F5F9',
                    color: r.estado === 'activo' ? '#059669' : '#64748B',
                  }}>{r.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────
const TABS = [
  { id: 'estado',    label: 'Estado de resultados' },
  { id: 'ingresos',  label: 'Ingresos' },
  { id: 'egresos',   label: 'Egresos' },
  { id: 'costos',    label: 'Por obra' },
  { id: 'flujo',     label: 'Flujo de caja' },
  { id: 'cobrar',    label: 'Cuentas por cobrar' },
  { id: 'ejecutivo', label: 'Resumen ejecutivo' },
]

export default function GestorContabilidad({ datos }: { datos: DatosReportes }) {
  const [tab, setTab] = useState('estado')

  return (
    <div>
      {/* Topbar */}
      <div style={{
        padding: '12px 26px', borderBottom: '1px solid #E2E8F0',
        background: '#fff', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(15,23,42,.06)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>Reportes financieros</div>
        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>Exporta en PDF o Excel</div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 26px', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 18px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: 'none', borderBottom: `2.5px solid ${tab === t.id ? '#2563EB' : 'transparent'}`,
            background: 'none', color: tab === t.id ? '#2563EB' : '#64748B',
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: '24px 26px' }}>
        {tab === 'estado'    && <ReporteEstadoResultados data={datos.estadoResultados} />}
        {tab === 'ingresos'  && <ReporteIngresos         data={datos.ingresos} />}
        {tab === 'egresos'   && <ReporteEgresos          data={datos.egresos} />}
        {tab === 'cobrar'    && <ReporteCuentasCobrar    data={datos.cuentasCobrar} />}
        {tab === 'costos'    && <ReporteObraFinanciero    data={datos.obraFinanciero} />}
        {tab === 'flujo'     && <ReporteFlujo flujo30={datos.flujo30} flujo60={datos.flujo60} flujo90={datos.flujo90} flujoMes={datos.flujoMes} />}
        {tab === 'ejecutivo' && (
          <ReporteResumenEjecutivo
            data={datos.resumenObras}
            totalPorCobrar={datos.totalPorCobrar}
            totalVencido={datos.totalVencido}
            totalCostosMes={datos.totalCostosMes}
            totalIngresosMes={datos.totalIngresosMes}
          />
        )}
      </div>

    </div>
  )
}
