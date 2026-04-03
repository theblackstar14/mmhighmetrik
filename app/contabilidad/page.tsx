import { getDatosReportes } from '@/lib/contabilidad'
import GestorContabilidad from '@/components/contabilidad/GestorContabilidad'

export default async function ContabilidadPage() {
  const datos = await getDatosReportes()
  return <GestorContabilidad datos={datos} />
}
