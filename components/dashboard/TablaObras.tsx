import type { ProyectoResumen } from '@/lib/types/database'

interface Props { data: ProyectoResumen[] }

const estadoStyle = (e: string) => {
  if (e === 'activo')    return { bg: '#f0fdf4', color: '#15803d', label: 'Al día' }
  if (e === 'pausado')   return { bg: '#fffbeb', color: '#92400e', label: 'En riesgo' }
  return { bg: '#fef2f2', color: '#b91c1c', label: 'Atrasado' }
}

export default function TablaObras({ data }: Props) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5ed', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Obras activas</div>
        <div style={{ fontSize: 10.5, color: '#8c96ae', marginTop: 2 }}>Estado y avance financiero</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Obra / Cliente','Avance','Margen','Estado'].map(h => (
            <th key={h} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.8px', color: '#8c96ae', padding: '0 0 9px', borderBottom: '1px solid #e1e5ed', textAlign: 'left', fontWeight: 500 }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {data.map(p => {
            const st = estadoStyle(p.estado)
            const mc = p.margen < 15 ? '#b91c1c' : p.margen < 22 ? '#92400e' : '#15803d'
            return (
              <tr key={p.id}>
                <td style={{ padding: '10px 0', borderBottom: '1px solid #e1e5ed' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{p.nombre}</div>
                  <div style={{ fontSize: 10, color: '#8c96ae', marginTop: 1 }}>{p.cliente} · S/ {p.presupuesto_contrato.toLocaleString()}</div>
                </td>
                <td style={{ padding: '10px 0', borderBottom: '1px solid #e1e5ed' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: mc }}>{p.avance_fisico}%</div>
                  <div style={{ height: 3, background: '#f2f4f7', borderRadius: 2, width: 68, marginTop: 4 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: mc, width: `${p.avance_fisico}%` }} />
                  </div>
                </td>
                <td style={{ padding: '10px 0', borderBottom: '1px solid #e1e5ed', fontWeight: 600, fontSize: 12, color: mc }}>{p.margen}%</td>
                <td style={{ padding: '10px 0', borderBottom: '1px solid #e1e5ed' }}>
                  <span style={{ background: st.bg, color: st.color, fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 3 }}>{st.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}