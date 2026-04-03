import { getDatosIngenieria } from '@/lib/ingenieria'
import GestorIngenieria from '@/components/ingenieria/GestorIngenieria'

export default async function IngenieriaPage() {
  const datos = await getDatosIngenieria()
  return <GestorIngenieria datos={datos} />
}
