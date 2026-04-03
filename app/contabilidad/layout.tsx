import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

async function getUsuarioActual() {
  const supabase = await createClient()
  const { data } = await supabase.from('usuario').select('nombre, rol').single()
  return data ?? { nombre: 'Usuario', rol: 'admin' }
}

export default async function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  const user = await getUsuarioActual()
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#EEF2F8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Sidebar user={user} />
      <main style={{ marginLeft: 220, flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}
