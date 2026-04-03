import { getDatosLicitaciones } from '@/lib/licitaciones'
import GestorLicitaciones from '@/components/licitaciones/GestorLicitaciones'

export default async function LicitacionesPage() {
  const datos = await getDatosLicitaciones()
  return <GestorLicitaciones datos={datos} />
}
