function Sk({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: 'linear-gradient(90deg, #E2E8F0 25%, #EEF2F8 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(15,23,42,.07)', ...style }}>
      {children}
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Topbar */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Sk h={16} w={180} />
          <Sk h={10} w={260} />
        </div>
        <Sk h={32} w={340} r={8} />
      </div>

      <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Sk h={10} w="60%" />
                <Sk h={26} w="80%" />
                <Sk h={10} w="50%" />
              </div>
            </Card>
          ))}
        </div>

        {/* Charts row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Card><Sk h={14} w={160} /><div style={{ marginTop: 16 }}><Sk h={200} /></div></Card>
          <Card><Sk h={14} w={140} /><div style={{ marginTop: 16 }}><Sk h={200} /></div></Card>
        </div>

        {/* Charts row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card><Sk h={14} w={160} /><div style={{ marginTop: 16 }}><Sk h={180} /></div></Card>
          <Card><Sk h={14} w={140} /><div style={{ marginTop: 16 }}><Sk h={180} /></div></Card>
        </div>

        {/* Alertas + IA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <Sk h={14} w={140} />
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 65, 70].map((w, j) => <Sk key={j} h={52} w={`${w}%`} r={8} />)}
              </div>
            </Card>
          ))}
        </div>

        {/* Vencimientos + Riesgo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <Sk h={14} w={160} />
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3].map((j) => <Sk key={j} h={44} r={8} />)}
              </div>
            </Card>
          ))}
        </div>

        {/* Sankey */}
        <Card><Sk h={14} w={200} /><div style={{ marginTop: 16 }}><Sk h={260} /></div></Card>
      </div>
    </>
  )
}
