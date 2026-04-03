import { getDatosFacturacion } from '@/lib/facturacion'
import { getEmpresaId }        from '@/lib/empresa'
import GestorFacturacion        from '@/components/facturacion/GestorFacturacion'

export default async function FacturacionPage() {
  const [datos, empresaId] = await Promise.all([
    getDatosFacturacion(),
    getEmpresaId(),
  ])

  return (
    <div>
      {/* Topbar */}
      <div style={{
        padding: '14px 26px', borderBottom: '1px solid #E2E8F0',
        background: '#fff', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 4px rgba(15,23,42,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-.3px' }}>Facturación</div>
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
            Facturas emitidas · recibidas · gastos · tipo de cambio SUNAT
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8' }}>
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <GestorFacturacion datos={datos} empresaId={empresaId} />
    </div>
  )
}
