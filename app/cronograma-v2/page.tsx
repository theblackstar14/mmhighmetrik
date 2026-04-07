import { createClient } from '@/lib/supabase/server'
import GestorCronogramaV2 from '@/components/cronograma-v2/GestorCronogramaV2'

async function getDatos() {
  const supabase = await createClient()
  const { data: usuario } = await supabase.from('usuario').select('empresa_id').single()
  const empresaId = usuario?.empresa_id ?? ''

  const { data: cronogramas, error } = await supabase
    .from('cronograma_mpp')
    .select('id, nombre, archivo, tareas, created_at')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  const tableNotFound = !!error && (
    error.message?.includes('does not exist') || (error as any).code === '42P01'
  )

  return { cronogramas: cronogramas ?? [], empresaId, dbExists: !tableNotFound }
}

export default async function CronogramaV2Page() {
  const datos = await getDatos()
  return <GestorCronogramaV2 {...datos} />
}
