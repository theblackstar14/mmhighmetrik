'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { DatosRUC } from '@/lib/sunat'

interface Props {
  value:         string
  onChange:      (ruc: string) => void
  onDatosRUC?:   (datos: (DatosRUC & { tipo: string }) | null) => void
  onSunatError?: (error: string) => void
  label?:        string
  placeholder?:  string
  disabled?:     boolean
}

type Estado = 'idle' | 'loading' | 'ok' | 'error'

export default function InputRUC({
  value, onChange, onDatosRUC, onSunatError,
  label = 'RUC', placeholder = '20601234567', disabled,
}: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [datos,  setDatos]  = useState<(DatosRUC & { tipo: string }) | null>(null)
  const [error,  setError]  = useState<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscar = useCallback(async (ruc: string) => {
    if (!/^\d{11}$/.test(ruc)) return
    setEstado('loading')
    try {
      const res  = await fetch(`/api/sunat/ruc?numero=${ruc}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error consultando SUNAT')
      setDatos(json)
      setEstado('ok')
      onDatosRUC?.(json)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg)
      setEstado('error')
      setDatos(null)
      onDatosRUC?.(null)
      onSunatError?.(msg)
    }
  }, [onDatosRUC, onSunatError])

  // Auto-buscar cuando el RUC llega a 11 dígitos (debounce 600ms)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!/^\d{11}$/.test(value)) {
      setEstado('idle')
      setDatos(null)
      onDatosRUC?.(null)
      return
    }

    timerRef.current = setTimeout(() => buscar(value), 600)
  }, [value])  // eslint-disable-line react-hooks/exhaustive-deps

  const borderColor =
    estado === 'ok'      ? '#10B981' :
    estado === 'error'   ? '#EF4444' :
    estado === 'loading' ? '#94A3B8' : '#E2E8F0'

  const listo = /^\d{11}$/.test(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 11.5, fontWeight: 600, color: '#374151' }}>{label}</label>}

      {/* Input + botón */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={value}
            onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 36px 9px 12px',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 8, fontSize: 13, color: '#0F172A',
              background: disabled ? '#F8FAFC' : '#fff',
              outline: 'none', transition: 'border-color .15s',
            }}
          />
          {/* Icono de estado */}
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none' }}>
            {estado === 'loading' && <span style={{ color: '#94A3B8' }}>⏳</span>}
            {estado === 'ok'      && <span style={{ color: '#10B981' }}>✓</span>}
            {estado === 'error'   && <span style={{ color: '#EF4444' }}>✗</span>}
          </div>
        </div>

        {/* Botón buscar */}
        <button
          type="button"
          onClick={() => buscar(value)}
          disabled={!listo || estado === 'loading' || disabled}
          style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: listo && estado !== 'loading' ? 'pointer' : 'default',
            border: '1.5px solid',
            borderColor: listo ? '#2563EB' : '#E2E8F0',
            background: listo ? '#EFF6FF' : '#F8FAFC',
            color: listo ? '#2563EB' : '#94A3B8',
            whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'all .15s',
          }}
        >
          {estado === 'loading' ? 'Buscando…' : 'Buscar RUC'}
        </button>
      </div>

      {/* Resultado */}
      {estado === 'ok' && datos && (
        <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
          {/* Nombre + tipo persona */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>{datos.nombre}</div>
            {datos.tipo && datos.tipo !== '—' && (
              <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 4, background: datos.tipo === 'JURIDICA' ? '#EFF6FF' : '#FAF5FF', color: datos.tipo === 'JURIDICA' ? '#1D4ED8' : '#6D28D9', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {datos.tipo === 'JURIDICA' ? 'Jurídica' : 'Natural'}
              </span>
            )}
          </div>

          {/* Tipo de empresa (SAC, SA, EIRL...) + actividad */}
          {(datos.tipoEmpresa || datos.actividadEconomica) && (
            <div style={{ fontSize: 10, color: '#475569', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {datos.tipoEmpresa && <span>{datos.tipoEmpresa}</span>}
              {datos.tipoEmpresa && datos.actividadEconomica && <span style={{ color: '#CBD5E1' }}>·</span>}
              {datos.actividadEconomica && <span>{datos.actividadEconomica}</span>}
            </div>
          )}

          {/* Estado + condición + badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: datos.estado === 'ACTIVO' ? '#ECFDF5' : '#FEF2F2', color: datos.estado === 'ACTIVO' ? '#059669' : '#DC2626', fontWeight: 600 }}>
              {datos.estado}
            </span>
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: datos.condicion === 'HABIDO' ? '#EFF6FF' : '#FFF7ED', color: datos.condicion === 'HABIDO' ? '#2563EB' : '#D97706', fontWeight: 600 }}>
              {datos.condicion}
            </span>
            {datos.esAgenteRetencion && (
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#FDF4FF', color: '#7C3AED', fontWeight: 600 }}>
                Agente retención
              </span>
            )}
            {datos.esBuenContribuyente && (
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#F0FDF4', color: '#15803D', fontWeight: 600 }}>
                Buen contribuyente
              </span>
            )}
          </div>

          {/* Dirección */}
          {datos.direccion && (
            <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 4 }}>
              {datos.direccion}{datos.distrito ? `, ${datos.distrito}` : ''}{datos.departamento ? ` — ${datos.departamento}` : ''}
            </div>
          )}

          {/* Info extra: trabajadores + comercio exterior */}
          {(datos.numeroTrabajadores || datos.comercioExterior) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              {datos.numeroTrabajadores && (
                <span style={{ fontSize: 10, color: '#94A3B8' }}>
                  {datos.numeroTrabajadores} trabajadores
                </span>
              )}
              {datos.comercioExterior && datos.comercioExterior !== 'SIN ACTIVIDAD' && (
                <span style={{ fontSize: 10, color: '#94A3B8' }}>
                  Comercio exterior: {datos.comercioExterior}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error con instrucción clara */}
      {estado === 'error' && (
        <div style={{ padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#C2410C' }}>No se pudo consultar SUNAT</div>
          <div style={{ fontSize: 10.5, color: '#92400E', marginTop: 2, lineHeight: 1.4 }}>{error}</div>
          <div style={{ fontSize: 10.5, color: '#92400E', marginTop: 4, fontWeight: 600 }}>
            → Ingresa la razón social manualmente en el campo de abajo.
          </div>
        </div>
      )}
    </div>
  )
}
