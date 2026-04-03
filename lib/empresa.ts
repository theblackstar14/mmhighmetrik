import { createClient } from '@/lib/supabase/server'

export async function getEmpresaId(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario')
    .select('empresa_id')
    .single()
  return data?.empresa_id ?? ''
}
