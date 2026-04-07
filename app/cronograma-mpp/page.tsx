import { createClient } from '@/lib/supabase/server'
import GestorCronogramaMpp from '@/components/cronograma-mpp/GestorCronogramaMpp'

async function getDatos() {
  const supabase = await createClient()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('empresa_id')
    .single()

  const empresaId = usuario?.empresa_id ?? ''

  const { data: cronogramas, error } = await supabase
    .from('cronograma_mpp')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  const tableNotFound = !!error && (
    error.message?.includes('does not exist') ||
    (error as any).code === '42P01'
  )

  return {
    cronogramas: cronogramas ?? [],
    empresaId,
    dbExists: !tableNotFound,
  }
}

export default async function CronogramaMppPage() {
  const datos = await getDatos()
  return <GestorCronogramaMpp {...datos} />
}
