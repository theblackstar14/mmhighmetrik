import { createClient } from '@/lib/supabase/server'
import GestorCotizacionesV2 from '@/components/cotizaciones-v2/GestorCotizacionesV2'

async function getDatos() {
  const supabase  = await createClient()
  const { data: usuario } = await supabase.from('usuario').select('empresa_id').single()
  const empresaId = usuario?.empresa_id ?? ''

  const { data: cotizaciones, error: errCot } = await supabase
    .from('cotizacion')
    .select('id, numero_cot, revision, proyecto, cliente, fecha, total, estado, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  const dbExists = !(errCot && (errCot.message?.includes('does not exist') || (errCot as any).code === '42P01'))

  // Usa la tabla proyecto existente (la misma que usa la página de Obras)
  const { data: obras } = await supabase
    .from('proyecto')
    .select('id, nombre, estado, codigo')
    .eq('empresa_id', empresaId)
    .order('nombre')

  return {
    cotizaciones: cotizaciones ?? [],
    empresaId,
    dbExists,
    obras:        obras ?? [],
    dbObraExists: true, // tabla proyecto siempre existe si Obras funciona
  }
}

export default async function CotizacionesV2Page() {
  const datos = await getDatos()
  return <GestorCotizacionesV2 {...datos} />
}
