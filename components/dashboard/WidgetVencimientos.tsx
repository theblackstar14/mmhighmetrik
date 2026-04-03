import type { VencimientoItem } from '@/lib/types/database'

interface Props { data: VencimientoItem[] }

function semaforo(dias: number, tipo: 'cobro' | 'pago') {
  if (dias <= 3)  return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', urgencia: 'Urgente'  }
  if (dias <= 7)  return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', urgencia: 'Esta semana' }
  if (dias <= 14) return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A', urgencia: 'Próximo' }
  return tipo === 'cobro'
    ? { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', urgencia: 'Cobro' }
    : { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE', urgencia: 'Pago' }
}

export default function WidgetVencimientos({ data }: Props) {
  const cobros = data.filter(v => v.tipo === 'cobro')
  const pagos  = data.filter(v => v.tipo === 'pago')
  const totalCobros = cobros.reduce((s, v) => s + v.monto, 0)
  const totalPagos  = pagos.reduce((s, v) => s + v.monto, 0)

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Vencimientos próximos</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>Cobros y pagos en los próximos 30 días</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>Por cobrar</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>S/ {totalCobros.toLocaleString()}</div>
          </div>
          <div style={{ width: 1, background: '#E2E8F0' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>Por pagar</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>S/ {totalPagos.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 11 }}>
          Sin vencimientos en los próximos 30 días
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(v => {
            const s = semaforo(v.dias_para_vencer, v.tipo)
            return (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: s.bg, border: `1px solid ${s.border}`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                    {v.dias_para_vencer}
                  </div>
                  <div style={{ fontSize: 8.5, color: s.color, opacity: .7 }}>días</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.descripcion}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                    {v.fecha} · {v.origen}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: v.tipo === 'cobro' ? '#2563EB' : '#DC2626' }}>
                    {v.tipo === 'cobro' ? '+' : '-'}S/ {v.monto.toLocaleString()}
                  </div>
                  <span style={{ fontSize: 9, background: '#fff', color: s.color, padding: '1px 6px', borderRadius: 4, border: `1px solid ${s.border}`, fontWeight: 600 }}>
                    {s.urgencia}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
