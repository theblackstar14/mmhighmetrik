export default function LicitacionesLoading() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', borderRadius: 6,
  }
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ ...shimmer, width: 110, height: 18, marginBottom: 6 }} /><div style={{ ...shimmer, width: 200, height: 11 }} /></div>
        <div style={{ ...shimmer, width: 120, height: 34 }} />
      </div>
      <div style={{ padding: '22px 26px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ ...shimmer, height: 80, borderRadius: 10 }} />)}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {Array.from({length: 7}).map((_,i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 14 }}>
              {[80,180,130,70,90,80,70,60].map((w,j) => <div key={j} style={{ ...shimmer, width: w, height: 14 }} />)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
