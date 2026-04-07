'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',          icon: '▦', label: 'Dashboard'    },
  { href: '/obras',              icon: '⬡', label: 'Obras'        },
  { href: '/ingenieria',         icon: '△', label: 'Ingeniería'   },
  { href: '/cambios-alcance',    icon: '⊕', label: 'Alcance'      },
  { href: '/cronograma-mpp',     icon: '▤', label: 'Cronogramas'  },
  { href: '/cronograma-v2',      icon: '▥', label: 'Cronograma V2' },
  { href: '/cotizaciones-v2',    icon: '◧', label: 'Cotizaciones'  },
  { href: '/licitaciones',       icon: '◈', label: 'Licitaciones' },
  { href: '/contabilidad',       icon: '⊞', label: 'Contabilidad' },
  { href: '/facturacion',        icon: '⊟', label: 'Facturación'  },
  { href: '/tesoreria',          icon: '◎', label: 'Tesorería'    },
  { href: '/proveedores',        icon: '◫', label: 'Proveedores'  },
  { href: '/reportes/ejecutivo', icon: '◑', label: 'Reportes'     },
]

interface Props {
  user?: { nombre: string; rol: string }
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()

  const initials = (user?.nombre ?? 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 220,
      background: '#0C0C10',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      borderRight: '1px solid rgba(255,255,255,.04)',
    }}>

      {/* ── Logo ── */}
      <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block', padding: '26px 22px 22px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        {/* MM mark — dos M geométricas */}
        <svg width="76" height="42" viewBox="0 0 76 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* primera M */}
          <polyline points="1,40 1,2 19,24 37,2 37,40" stroke="#7C8292" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
          {/* segunda M */}
          <polyline points="41,40 41,2 59,24 77,2 77,40" stroke="#5A5E72" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" fill="none"/>
        </svg>
        {/* HIGHMETRIK */}
        <div style={{
          fontSize: 9.5, letterSpacing: '4px', textTransform: 'uppercase',
          color: '#6B7280', marginTop: 9, fontWeight: 700,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          HIGHMETRIK
        </div>
        {/* ENGINEERS */}
        <div style={{
          fontSize: 7.5, letterSpacing: '3px', textTransform: 'uppercase',
          color: '#3D4152', marginTop: 4, fontWeight: 500,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          ENGINEERS
        </div>
      </Link>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '18px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 12px', borderRadius: 8,
                color: active ? '#F0F1F5' : '#6B7180',
                background: active ? 'rgba(141,145,158,.12)' : 'transparent',
                borderLeft: active ? '2px solid #9CA3AF' : '2px solid transparent',
                fontSize: 12, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
                textDecoration: 'none', transition: 'all .15s',
                letterSpacing: '.1px',
              }}
            >
              <span style={{ fontSize: 10.5, color: active ? '#9CA3AF' : '#3D4152', minWidth: 14 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Divider ── */}
      <div style={{ margin: '0 16px', height: 1, background: 'rgba(255,255,255,.05)' }} />

      {/* ── User ── */}
      <div style={{ padding: '12px 10px 18px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6B7280, #9CA3AF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.nombre ?? 'Usuario'}
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.28)', marginTop: 1, textTransform: 'capitalize' }}>
              {user?.rol ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
