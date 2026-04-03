import { getDatosCambiosAlcance } from '@/lib/cambios-alcance'
import GestorCambiosAlcance from '@/components/cambios-alcance/GestorCambiosAlcance'

export default async function CambiosAlcancePage() {
  const datos = await getDatosCambiosAlcance()
  return <GestorCambiosAlcance datos={datos} />
}
