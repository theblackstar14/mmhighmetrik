'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Rango } from '@/lib/dashboard'

const OPCIONES: { key: Rango; label: string }[] = [
  { key: 'mes',    label: 'Este mes'    },
  { key: 'mesant', label: 'Mes anterior' },
  { key: 'trim',   label: 'Trimestre'   },
  { key: 'sem',    label: 'Semestre'    },
  { key: 'anio',   label: 'Este año'    },
]

export default function FiltroFechas() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const rangoActual  = (searchParams.get('rango') ?? 'mes') as Rango

  const setRango = (r: Rango) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('rango', r)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
      {OPCIONES.map(o => {
        const active = rangoActual === o.key
        return (
          <button
            key={o.key}
            onClick={() => setRango(o.key)}
            style={{
              fontSize: 11, fontWeight: active ? 600 : 400,
              padding: '5px 13px', borderRadius: 8, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit',
              background: active ? '#fff' : 'transparent',
              color: active ? '#0F172A' : '#64748B',
              boxShadow: active ? '0 1px 3px rgba(15,23,42,.12)' : 'none',
              transition: 'all .15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
