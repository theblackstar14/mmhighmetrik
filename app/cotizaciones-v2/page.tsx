import { createClient } from '@/lib/supabase/server'
import GestorCotizacionesV2 from '@/components/cotizaciones-v2/GestorCotizacionesV2'

async function getDatos() {
  const supabase  = await createClient()
  const { data: usuario } = await supabase.from('usuario').select('empresa_id').single()
  const empresaId = usuario?.empresa_id ?? ''

  const { data: cotizaciones, error } = await supabase
    .from('cotizacion')
    .select('id, numero_cot, revision, proyecto, cliente, fecha, total, estado, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  const tableNotFound = !!error && (
    error.message?.includes('does not exist') || (error as any).code === '42P01'
  )

  return { cotizaciones: cotizaciones ?? [], empresaId, dbExists: !tableNotFound }
}

export default async function CotizacionesV2Page() {
  const datos = await getDatos()
  return <GestorCotizacionesV2 {...datos} />
}
