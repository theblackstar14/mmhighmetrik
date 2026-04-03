interface Props {
  banner: {
    ingresos_anio: number
    margen_anio: number
    proyectos_riesgo: number
    total_por_cobrar: number
    backlog: number
  }
  anio: number
}

export default function BannerEjecutivo({ banner, anio }: Props) {
  const color = banner.margen_anio >= 20 ? '#059669' : banner.margen_anio >= 10 ? '#D97706' : '#DC2626'

  return (
    <div style={{
      background: '#0C0C10',
      border: '1px solid rgba(141,145,158,.15)',
      borderRadius: 12, padding: '18px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 3, height: 36, background: 'linear-gradient(180deg,#8D919E,#5A5E72)', borderRadius: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, color: '#5A5E72', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>
            Resumen ejecutivo · {anio}
          </div>
          <div style={{ fontSize: 13.5, color: '#E2E4EC', fontWeight: 500, lineHeight: 1.5 }}>
            Ingresos anuales{' '}
            <strong style={{ color: '#fff' }}>S/ {banner.ingresos_anio.toLocaleString()}</strong>
            {' '}· Margen{' '}
            <strong style={{ color }}>{banner.margen_anio}%</strong>
            {banner.proyectos_riesgo > 0 && (
              <> · <strong style={{ color: '#DC2626' }}>{banner.proyectos_riesgo} proyecto{banner.proyectos_riesgo > 1 ? 's' : ''} en riesgo</strong></>
            )}
            {' '}· Backlog{' '}
            <strong style={{ color: '#8D919E' }}>S/ {banner.backlog.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
        {[
          { label: 'Por cobrar', val: `S/ ${banner.total_por_cobrar.toLocaleString()}`, color: '#D97706' },
          { label: 'Backlog',    val: `S/ ${banner.backlog.toLocaleString()}`,           color: '#8D919E' },
        ].map(k => (
          <div key={k.label} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#5A5E72', textTransform: 'uppercase', letterSpacing: '.8px' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
