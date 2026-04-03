'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SubirPortada from './SubirPortada'
import type { ObraCard } from '@/lib/obras'

const RIESGO = {
  ok:      { label: 'Al día',   bg: '#ECFDF5', color: '#059669', dot: '#10B981' },
  medio:   { label: 'Atención', bg: '#FFFBEB', color: '#B45309', dot: '#F59E0B' },
  alto:    { label: 'Riesgo',   bg: '#FFF7ED', color: '#C2410C', dot: '#F97316' },
  critico: { label: 'Crítico',  bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
}

const BAR_COLOR = {
  ok:      '#10B981',
  medio:   '#F59E0B',
  alto:    '#F97316',
  critico: '#EF4444',
}

const PLACEHOLDER_COLORS: Record<string, string> = {
  publico:  'linear-gradient(135deg, #1E3A5F 0%, #2D5282 100%)',
  privado:  'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
}

interface Props { obra: ObraCard }

export default function TarjetaObra({ obra }: Props) {
  const [imagenUrl, setImagenUrl] = useState(obra.imagen_url)
  const [hoverImg,  setHoverImg]  = useState(false)

  const riesgo    = RIESGO[obra.nivel_riesgo]
  const barColor  = BAR_COLOR[obra.nivel_riesgo]
  const avancePct = `${obra.avance_fisico}%`
  const esperadoPct = `${Math.min(100, obra.avance_esperado)}%`

  const desvioLabel = obra.desvio_tiempo >= 0
    ? `+${obra.desvio_tiempo}pp`
    : `${obra.desvio_tiempo}pp`
  const desvioColor = obra.desvio_tiempo >= 0 ? '#059669'
    : obra.desvio_tiempo >= -5 ? '#B45309'
    : '#B91C1C'

  const diasLabel = obra.atrasado
    ? `${obra.dias_restantes}d atrasado`
    : `${obra.dias_restantes}d restantes`
  const diasColor = obra.atrasado ? '#B91C1C'
    : obra.dias_restantes < 30 ? '#B45309'
    : '#64748B'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(15,23,42,.08)',
      border: '1px solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow .2s, transform .2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(15,23,42,.13)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(15,23,42,.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >

      {/* ── Portada ── */}
      <div
        style={{ position: 'relative', height: 165, flexShrink: 0, cursor: 'pointer' }}
        onMouseEnter={() => setHoverImg(true)}
        onMouseLeave={() => setHoverImg(false)}
      >
        {imagenUrl ? (
          <Image
            src={imagenUrl}
            alt={obra.nombre}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: PLACEHOLDER_COLORS[obra.tipo] ?? PLACEHOLDER_COLORS.publico, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="10" fill="rgba(255,255,255,.06)" />
              <path d="M8 34L8 10L22 24L36 10L36 34" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
            </svg>
          </div>
        )}

        {/* Gradient overlay bottom */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.65) 0%, transparent 55%)', pointerEvents: 'none' }} />

        {/* Badges top-left */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'rgba(0,0,0,.5)', color: 'rgba(255,255,255,.85)', backdropFilter: 'blur(4px)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {obra.codigo}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: obra.tipo === 'publico' ? 'rgba(37,99,235,.7)' : 'rgba(124,58,237,.7)', color: '#fff', backdropFilter: 'blur(4px)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {obra.tipo}
          </span>
        </div>

        {/* Upload button top-right */}
        <div style={{ position: 'absolute', top: 10, right: 10, opacity: hoverImg ? 1 : 0, transition: 'opacity .2s' }}>
          <SubirPortada proyectoId={obra.id} onUploaded={url => setImagenUrl(url)} />
        </div>

        {/* Nombre sobre imagen */}
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,.4)' }}>
            {obra.nombre}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{obra.cliente}</div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Riesgo badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: riesgo.color, background: riesgo.bg, padding: '3px 9px', borderRadius: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: riesgo.dot, flexShrink: 0 }} />
            {riesgo.label}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: diasColor }}>{diasLabel}</span>
        </div>

        {/* Barra de avance */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>Avance físico</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{avancePct}</span>
          </div>
          {/* track */}
          <div style={{ height: 7, background: '#F1F5F9', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
            {/* avance real */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: avancePct, background: barColor, borderRadius: 4, transition: 'width .4s' }} />
          </div>
          {/* esperado marker */}
          <div style={{ position: 'relative', height: 12 }}>
            <div style={{ position: 'absolute', left: esperadoPct, transform: 'translateX(-50%)', top: 1 }}>
              <div style={{ width: 1, height: 6, background: '#94A3B8', margin: '0 auto' }} />
              <div style={{ fontSize: 8.5, color: '#94A3B8', whiteSpace: 'nowrap', transform: 'translateX(-40%)', marginTop: 1 }}>{obra.avance_esperado}% esp.</div>
            </div>
          </div>
        </div>

        {/* KPIs fila */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 2 }}>
          {[
            { label: 'Contrato',  val: `S/ ${(obra.presupuesto_contrato / 1000000).toFixed(1)}M`, color: '#2563EB' },
            { label: 'Margen',    val: `${obra.margen}%`,                                         color: obra.margen >= 20 ? '#059669' : obra.margen >= 10 ? '#B45309' : '#B91C1C' },
            { label: 'Desvío t.', val: desvioLabel,                                               color: desvioColor },
          ].map(k => (
            <div key={k.label} style={{ textAlign: 'center', padding: '6px 4px', background: '#F8FAFC', borderRadius: 7 }}>
              <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Ver detalle */}
        <Link href={`/obras/${obra.id}`} style={{
          display: 'block', textAlign: 'center', padding: '8px',
          borderRadius: 8, border: '1px solid #E2E8F0',
          background: '#F8FAFC', color: '#0F172A',
          fontSize: 11.5, fontWeight: 600, textDecoration: 'none',
          transition: 'background .15s',
          marginTop: 'auto',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#EEF2F8' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F8FAFC' }}
        >
          Ver detalle →
        </Link>
      </div>
    </div>
  )
}
