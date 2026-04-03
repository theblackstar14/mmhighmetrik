export default function ObraDetalleLoading() {
  const sh: React.CSSProperties = {
    background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
  }
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* Portada */}
      <div style={{ ...sh, height: 220, borderRadius: 0 }} />
      {/* KPI strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '10px 20px', gap: 24 }}>
        {[80,90,60,60,70,80,90,80].map((w,i) => <div key={i} style={{ ...sh, width: w, height: 36 }} />)}
      </div>
      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '12px 22px', display: 'flex', gap: 16 }}>
        {[80,100,72,86,80].map((w,i) => <div key={i} style={{ ...sh, width: w, height: 14 }} />)}
      </div>
      {/* Content */}
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...sh, height: 140 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ ...sh, height: 200 }} />
          <div style={{ ...sh, height: 200 }} />
        </div>
      </div>
    </>
  )
}
