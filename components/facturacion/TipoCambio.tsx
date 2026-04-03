'use client'
import { useState, useEffect } from 'react'

interface TC { fecha: string; compra: number; venta: number }

interface Props {
  /** Si se pasa monto y moneda, muestra la conversión */
  monto?:  number
  moneda?: 'PEN' | 'USD'
  /** Muestra conversión en ambas monedas */
  showConverter?: boolean
  compact?: boolean
}

export default function TipoCambio({ monto, moneda, showConverter, compact }: Props) {
  const [tc,     setTc]     = useState<TC | null>(null)
  const [error,  setError]  = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/sunat/tc')
      .then(r => r.json())
      .then(d => { setTc(d); setLoaded(true) })
      .catch(() => { setError(true); setLoaded(true) })
  }, [])

  if (!loaded) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94A3B8' }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Cargando TC…
    </div>
  )

  if (error || !tc) return (
    <div style={{ fontSize: 11, color: '#94A3B8' }}>TC no disponible</div>
  )

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748B', padding: '4px 10px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
        <span style={{ fontWeight: 600, color: '#0F172A' }}>TC SUNAT</span>
        <span>Compra S/ {tc.compra.toFixed(3)}</span>
        <span style={{ color: '#CBD5E1' }}>|</span>
        <span>Venta S/ {tc.venta.toFixed(3)}</span>
        <span style={{ color: '#CBD5E1' }}>|</span>
        <span style={{ color: '#94A3B8' }}>{tc.fecha}</span>
      </div>
    )
  }

  const enPEN = moneda === 'USD' && monto ? monto * tc.venta  : null
  const enUSD = moneda === 'PEN' && monto ? monto / tc.venta  : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* TC strip */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>TC SUNAT · {tc.fecha}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ padding: '3px 10px', background: '#EFF6FF', borderRadius: 5, fontSize: 11, color: '#2563EB', fontWeight: 600 }}>
            Compra S/ {tc.compra.toFixed(3)}
          </div>
          <div style={{ padding: '3px 10px', background: '#F0FDF4', borderRadius: 5, fontSize: 11, color: '#059669', fontWeight: 600 }}>
            Venta S/ {tc.venta.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Conversión */}
      {(enPEN !== null || enUSD !== null || showConverter) && monto != null && (
        <div style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', flexWrap: 'wrap', alignItems: 'center' }}>
          {moneda === 'USD' && enPEN !== null && (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>$ {monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>=</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>S/ {enPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>(al tipo de venta)</span>
            </>
          )}
          {moneda === 'PEN' && enUSD !== null && (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>S/ {monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>=</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>$ {enUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>(al tipo de venta)</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
