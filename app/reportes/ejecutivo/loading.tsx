function Sk({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: 'linear-gradient(90deg,#E2E8F0 25%,#EEF2F8 50%,#E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, ...style }}>{children}</div>
}

export default function ReporteEjecutivoLoading() {
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ padding: '12px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <Sk h={16} w={200} />
      </div>
      <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Sk h={72} r={12} />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
          <Card><Sk h={14} w={180} /><div style={{ marginTop: 16 }}><Sk h={220} /></div></Card>
          <Card><Sk h={14} w={160} /><div style={{ marginTop: 16 }}><Sk h={220} /></div></Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card><Sk h={14} w={140} /><div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <Sk key={i} h={40} r={8} />)}</div></Card>
          <Card><Sk h={14} w={140} /><div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4].map(i => <Sk key={i} h={32} r={6} />)}</div></Card>
        </div>
        <Card><Sk h={14} w={200} /><div style={{ marginTop: 16 }}><Sk h={280} /></div></Card>
      </div>
    </>
  )
}
