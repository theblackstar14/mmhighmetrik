'use client'
import { useState } from 'react'
import type { PartidaDetalle } from '@/lib/obras'

interface Props {
  partidas: PartidaDetalle[]
  fechaIniProyecto: string | null
  fechaFinProyecto: string | null
}

const BAR_COLORS = {
  completada: '#94A3B8',
  ok:         '#10B981',
  medio:      '#F59E0B',
  alto:       '#F97316',
  critico:    '#EF4444',
}

function nivelPartida(p: PartidaDetalle, today: Date): keyof typeof BAR_COLORS {
  if (p.avance_fisico >= 100) return 'completada'
  if (!p.fecha_inicio || !p.fecha_fin) return 'ok'
  const ini    = new Date(p.fecha_inicio)
  const fin    = new Date(p.fecha_fin)
  const total  = fin.getTime() - ini.getTime()
  if (total <= 0) return 'ok'
  const elapsed   = Math.min(total, Math.max(0, today.getTime() - ini.getTime()))
  const esperado  = Math.round(elapsed / total * 100)
  const desvio    = p.avance_fisico - esperado
  if (today > fin && p.avance_fisico < 100) return 'critico'
  if (desvio < -20) return 'critico'
  if (desvio < -10) return 'alto'
  if (desvio < -5)  return 'medio'
  return 'ok'
}

function fmtMes(d: Date) {
  return d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
}

function fmtFecha(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
}

const RESP_COLORS: Record<string, string> = {}
const PALETTE = ['#6366F1','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6']
let colorIdx = 0
function getColor(name: string) {
  if (!name) return '#94A3B8'
  if (!RESP_COLORS[name]) { RESP_COLORS[name] = PALETTE[colorIdx % PALETTE.length]; colorIdx++ }
  return RESP_COLORS[name]
}

function Avatar({ name }: { name: string }) {
  const initials = name.replace('Ing.','').replace('Arq.','').trim().split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  return (
    <div title={name} style={{
      width: 22, height: 22, borderRadius: '50%',
      background: getColor(name),
      color: '#fff', fontSize: 8, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  )
}

export default function CronogramaObra({ partidas, fechaIniProyecto, fechaFinProyecto }: Props) {
  const [tooltip, setTooltip] = useState<PartidaDetalle | null>(null)
  const today = new Date()

  const conFechas = partidas.filter(p => p.fecha_inicio && p.fecha_fin)

  // Timeline range
  const allDates = [
    ...(fechaIniProyecto ? [new Date(fechaIniProyecto)] : []),
    ...(fechaFinProyecto ? [new Date(fechaFinProyecto)] : []),
    ...conFechas.flatMap(p => [new Date(p.fecha_inicio!), new Date(p.fecha_fin!)]),
  ]
  if (allDates.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
      Sin fechas de partidas. Ejecuta el SQL de actualización de fechas.
    </div>
  )

  const tIni  = new Date(Math.min(...allDates.map(d => d.getTime())))
  const tFin  = new Date(Math.max(...allDates.map(d => d.getTime())))
  tIni.setDate(1) // snap to month start
  tFin.setMonth(tFin.getMonth() + 1, 0) // snap to month end
  const totalMs = tFin.getTime() - tIni.getTime()

  // Generate months
  const months: { label: string; pct: number }[] = []
  const cur = new Date(tIni)
  while (cur <= tFin) {
    months.push({ label: fmtMes(new Date(cur)), pct: ((cur.getTime() - tIni.getTime()) / totalMs) * 100 })
    cur.setMonth(cur.getMonth() + 1)
  }

  const todayPct = Math.max(0, Math.min(100, ((today.getTime() - tIni.getTime()) / totalMs) * 100))

  const pos  = (d: string) => Math.max(0, Math.min(99, ((new Date(d).getTime() - tIni.getTime()) / totalMs) * 100))
  const wid  = (a: string, b: string) => Math.max(0.5, Math.min(100 - pos(a), ((new Date(b).getTime() - new Date(a).getTime()) / totalMs) * 100))

  const LEFT_W = 320

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(BAR_COLORS).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 10, color: '#64748B', textTransform: 'capitalize' }}>
              {k === 'completada' ? 'Completada' : k === 'ok' ? 'En cronograma' : k === 'medio' ? 'Atención' : k === 'alto' ? 'Riesgo' : 'Crítico'}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 1, height: 12, background: '#EF4444' }} />
          <span style={{ fontSize: 10, color: '#64748B' }}>Hoy</span>
        </div>
      </div>

      <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '1px solid #E2E8F0' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 68px 38px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '8px 10px', gap: 6 }}>
            {['Cód.', 'Partida', 'Responsable', '%'].map(h => (
              <div key={h} style={{ fontSize: 9.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {partidas.map(p => {
            const nivel = nivelPartida(p, today)
            const barC  = BAR_COLORS[nivel]
            return (
              <div
                key={p.id}
                onMouseEnter={() => setTooltip(p)}
                onMouseLeave={() => setTooltip(null)}
                style={{ display: 'grid', gridTemplateColumns: '52px 1fr 68px 38px', padding: '7px 10px', gap: 6, borderBottom: '1px solid #F1F5F9', alignItems: 'center', cursor: 'default', background: tooltip?.id === p.id ? '#F8FAFC' : 'transparent' }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>{p.codigo}</div>
                <div style={{ fontSize: 11, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.descripcion}>{p.descripcion}</div>
                <div>{p.responsable ? <Avatar name={p.responsable} /> : <span style={{ fontSize: 9, color: '#CBD5E1' }}>—</span>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.avance_fisico}%`, background: barC, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: barC }}>{p.avance_fisico}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Right panel (Gantt) ── */}
        <div style={{ flex: 1, overflowX: 'auto', minWidth: 0 }}>
          <div style={{ minWidth: 600, position: 'relative' }}>

            {/* Month headers */}
            <div style={{ display: 'flex', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', height: 33, position: 'relative' }}>
              {months.map((m, i) => (
                <div key={i} style={{
                  position: 'absolute', left: `${m.pct}%`,
                  fontSize: 9, color: '#64748B', fontWeight: 600,
                  padding: '4px 6px', whiteSpace: 'nowrap',
                  textTransform: 'uppercase', letterSpacing: '.4px',
                  top: '50%', transform: 'translateY(-50%)',
                }}>{m.label}</div>
              ))}
              {/* Month grid lines */}
              {months.map((m, i) => (
                <div key={i} style={{ position: 'absolute', left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: '#E2E8F0' }} />
              ))}
            </div>

            {/* Gantt rows */}
            {partidas.map(p => {
              const nivel = nivelPartida(p, today)
              const barC  = BAR_COLORS[nivel]
              const hasDates = p.fecha_inicio && p.fecha_fin
              return (
                <div
                  key={p.id}
                  onMouseEnter={() => setTooltip(p)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ position: 'relative', height: 37, borderBottom: '1px solid #F1F5F9', background: tooltip?.id === p.id ? '#F8FAFC' : 'transparent' }}
                >
                  {/* Month grid lines */}
                  {months.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${m.pct}%`, top: 0, bottom: 0, width: 1, background: '#F1F5F9' }} />
                  ))}

                  {/* Today line */}
                  <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1.5, background: 'rgba(239,68,68,.6)', zIndex: 5 }} />

                  {hasDates && (
                    <>
                      {/* Background track */}
                      <div style={{
                        position: 'absolute',
                        left:  `${pos(p.fecha_inicio!)}%`,
                        width: `${wid(p.fecha_inicio!, p.fecha_fin!)}%`,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 16, borderRadius: 4,
                        background: `${barC}22`,
                        border: `1px solid ${barC}44`,
                      }} />
                      {/* Progress fill */}
                      <div style={{
                        position: 'absolute',
                        left:  `${pos(p.fecha_inicio!)}%`,
                        width: `${wid(p.fecha_inicio!, p.fecha_fin!) * p.avance_fisico / 100}%`,
                        top: '50%', transform: 'translateY(-50%)',
                        height: 16, borderRadius: 4,
                        background: barC,
                        transition: 'width .3s',
                      }} />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          marginTop: 10, padding: '12px 16px',
          background: '#0F172A', borderRadius: 10,
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Partida</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>{tooltip.codigo} — {tooltip.descripcion}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Responsable</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tooltip.responsable ? getColor(tooltip.responsable) : '#64748B' }}>
              {tooltip.responsable ?? '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Fechas</div>
            <div style={{ fontSize: 12, color: '#F1F5F9' }}>{fmtFecha(tooltip.fecha_inicio)} → {fmtFecha(tooltip.fecha_fin)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Avance</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BAR_COLORS[nivelPartida(tooltip, today)] }}>{tooltip.avance_fisico}%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Presupuesto</div>
            <div style={{ fontSize: 12, color: '#F1F5F9' }}>S/ {tooltip.total?.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}
