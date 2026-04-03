'use client'
import { useRouter } from 'next/navigation'
import type { AlertaDashboard } from '@/lib/types/database'

interface Props { data: AlertaDashboard[] }

const tipoMeta = (tipo: AlertaDashboard['tipo']) =>
  tipo === 'error'
    ? { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA', label: 'Urgente' }
    : tipo === 'warning'
    ? { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', label: 'Atención' }
    : { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'Info' }

export default function PanelAlertas({ data }: Props) {
  const router = useRouter()

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Alertas</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Notificaciones importantes</div>
        </div>
        {data.length > 0 && (
          <span style={{ background: '#FEF2F2', color: '#B91C1C', fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: '1px solid #FECACA' }}>
            {data.length} activa{data.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: '#94A3B8', fontSize: 11 }}>
          ✓ Sin alertas activas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(alerta => {
            const st = tipoMeta(alerta.tipo)
            return (
              <div key={alerta.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: st.bg, border: `1px solid ${st.border}`,
              }}>
                {/* Indicador */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: st.color, flexShrink: 0, marginTop: 4,
                }} />

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', lineHeight: 1.4 }}>
                    {alerta.titulo}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                    {alerta.descripcion}
                  </div>
                  {alerta.monto && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: st.color, marginTop: 4 }}>
                      S/ {alerta.monto.toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Tipo + Botón Ver */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{ background: '#fff', color: st.color, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, border: `1px solid ${st.border}` }}>
                    {st.label}
                  </span>
                  {alerta.ruta && (
                    <button
                      onClick={() => router.push(alerta.ruta!)}
                      style={{
                        fontSize: 10, fontWeight: 600, color: st.color,
                        background: '#fff', border: `1px solid ${st.border}`,
                        borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Ver →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
