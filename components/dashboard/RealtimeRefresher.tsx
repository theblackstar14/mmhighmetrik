'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RealtimeRefresher() {
  const router     = useRouter()
  const [live, setLive] = useState(false)
  const lastRefresh = useRef<number>(Date.now())

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'factura' }, () => {
        // Debounce: no refrescar más de 1 vez cada 3s
        if (Date.now() - lastRefresh.current > 3000) {
          lastRefresh.current = Date.now()
          router.refresh()
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costo_directo' }, () => {
        if (Date.now() - lastRefresh.current > 3000) {
          lastRefresh.current = Date.now()
          router.refresh()
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flujo_caja_proyectado' }, () => {
        if (Date.now() - lastRefresh.current > 3000) {
          lastRefresh.current = Date.now()
          router.refresh()
        }
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: live ? '#059669' : '#94A3B8',
        boxShadow: live ? '0 0 0 2px rgba(5,150,105,.25)' : 'none',
        transition: 'all .3s',
      }} />
      <span style={{ fontSize: 10, color: live ? '#059669' : '#94A3B8', fontWeight: 500 }}>
        {live ? 'Tiempo real' : 'Conectando…'}
      </span>
    </div>
  )
}
