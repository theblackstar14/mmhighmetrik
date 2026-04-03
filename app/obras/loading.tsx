export default function ObrasLoading() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 6,
  }

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Topbar skeleton */}
      <div style={{ padding: '14px 26px', borderBottom: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ ...shimmer, width: 80, height: 18, marginBottom: 6 }} />
          <div style={{ ...shimmer, width: 200, height: 11 }} />
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[60, 80, 60, 60].map((w, i) => <div key={i} style={{ ...shimmer, width: w, height: 32 }} />)}
        </div>
      </div>

      {/* Cards skeleton */}
      <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            {/* Image area */}
            <div style={{ ...shimmer, height: 165, borderRadius: 0 }} />
            {/* Body */}
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ ...shimmer, width: 70, height: 20 }} />
                <div style={{ ...shimmer, width: 80, height: 14 }} />
              </div>
              <div style={{ ...shimmer, width: '100%', height: 7 }} />
              <div style={{ ...shimmer, width: 120, height: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[0,1,2].map(j => <div key={j} style={{ ...shimmer, height: 42 }} />)}
              </div>
              <div style={{ ...shimmer, width: '100%', height: 34 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
