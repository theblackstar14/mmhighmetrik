export default function FacturacionLoading() {
  const sh: React.CSSProperties = {
    background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
  }
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* Topbar */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ ...sh, width: 120, height: 18, marginBottom: 6 }} /><div style={{ ...sh, width: 280, height: 11 }} /></div>
        <div style={{ ...sh, width: 160, height: 14 }} />
      </div>
      {/* KPI strip */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '10px 26px', gap: 20 }}>
        {[80,90,90,80,80,80].map((w,i) => <div key={i} style={{ ...sh, width: w, height: 36 }} />)}
      </div>
      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '12px 26px', display: 'flex', gap: 16 }}>
        {[80,80,60,72].map((w,i) => <div key={i} style={{ ...sh, width: w, height: 14 }} />)}
      </div>
      {/* Table skeleton */}
      <div style={{ padding: '20px 26px' }}>
        <div style={{ ...sh, height: 38, marginBottom: 12, width: 480 }} />
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ ...sh, height: 36, borderRadius: 0 }} />
          {Array.from({length: 6}).map((_,i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: '1px solid #F1F5F9' }}>
              {[100,160,140,90,90,60,80,70].map((w,j) => <div key={j} style={{ ...sh, width: w, height: 14 }} />)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
