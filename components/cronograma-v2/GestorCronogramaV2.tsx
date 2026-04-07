'use client'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const GanttDhtmlx = dynamic(() => import('./GanttDhtmlx'), { ssr: false })

interface Tarea {
  id: number
  wbs: string
  nombre: string
  inicio: string | null
  fin: string | null
  avance: number
  dias_cal: number
  dias_lab: number
  predecesores: string
  costo: number | null
  recursos: string
  es_resumen: boolean
  nivel: number
}

interface Cronograma {
  id: string
  nombre: string
  archivo: string | null
  tareas: Tarea[]
  created_at: string
}

interface Props {
  cronogramas: Cronograma[]
  empresaId: string
  dbExists: boolean
}

export default function GestorCronogramaV2({ cronogramas, dbExists }: Props) {
  const [seleccionado, setSeleccionado] = useState<Cronograma | null>(cronogramas[0] ?? null)
  const [tab, setTab]               = useState<'gantt' | 'pdf'>('gantt')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError]     = useState('')
  const [pdfUrl, setPdfUrl]         = useState<string | null>(null)

  const verPdf = useCallback(async (c: Cronograma) => {
    const archivo = c.archivo ?? `${c.nombre}.mpp`
    setPdfLoading(true)
    setPdfError('')
    setPdfUrl(null)
    try {
      const res = await fetch(`/api/mpp-pdf?file=${encodeURIComponent(archivo)}`)
      const ct  = res.headers.get('content-type') ?? ''
      if (ct.includes('json')) {
        const err = await res.json()
        throw new Error(err.error ?? JSON.stringify(err))
      }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
    } catch (e: any) {
      setPdfError(e.message)
    } finally {
      setPdfLoading(false)
    }
  }, [])

  if (!dbExists) {
    return (
      <div style={{ padding: 32, color: '#94A3B8', fontSize: 14 }}>
        Primero crea la tabla cronograma_mpp desde el módulo Cronogramas.
      </div>
    )
  }

  const tareas: Tarea[] = seleccionado?.tareas ?? []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 240, flexShrink: 0, background: '#fff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Cronograma V2</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>dhtmlxGantt + PDF</div>
        </div>
        <div style={{ flex: 1, padding: '8px' }}>
          {cronogramas.length === 0 && (
            <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '24px 8px' }}>
              Sube cronogramas desde el módulo Cronogramas.
            </div>
          )}
          {cronogramas.map(c => (
            <div
              key={c.id}
              onClick={() => { setSeleccionado(c); setPdfUrl(null); setPdfError(''); setTab('gantt') }}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                background: seleccionado?.id === c.id ? '#EFF6FF' : 'transparent',
                border: seleccionado?.id === c.id ? '1px solid #BFDBFE' : '1px solid transparent',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 2 }}>{c.nombre}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>
                {new Date(c.created_at).toLocaleDateString('es-PE')} · {c.tareas?.length ?? 0} tareas
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
              {seleccionado?.nombre ?? 'Selecciona un cronograma'}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
            {(['gantt', 'pdf'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === 'pdf' && seleccionado && !pdfUrl) verPdf(seleccionado) }}
                style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#1E293B' : '#64748B',
                  fontSize: 12, fontWeight: tab === t ? 700 : 400,
                  cursor: 'pointer',
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}>
                {t === 'gantt' ? '▤ Gantt' : '📄 PDF'}
              </button>
            ))}
          </div>

          {tab === 'pdf' && pdfUrl && (
            <>
              <button onClick={() => window.open(pdfUrl, '_blank')}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}>
                ↗ Nueva pestaña
              </button>
              <button onClick={() => { const a = document.createElement('a'); a.href = pdfUrl!; a.download = `${seleccionado?.nombre}.pdf`; a.click() }}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}>
                ⬇ Descargar
              </button>
            </>
          )}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* Tab Gantt */}
          {tab === 'gantt' && (
            <div style={{ width: '100%', height: '100%' }}>
              {!seleccionado ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: 14 }}>
                  Selecciona un cronograma
                </div>
              ) : tareas.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: 14 }}>
                  Sin tareas disponibles
                </div>
              ) : (
                <GanttDhtmlx tareas={tareas} />
              )}
            </div>
          )}

          {/* Tab PDF */}
          {tab === 'pdf' && (
            <div style={{ width: '100%', height: '100%' }}>
              {pdfLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#64748B' }}>Convirtiendo MPP a PDF...</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Primera vez tarda ~1 min, luego es instantáneo</div>
                </div>
              )}
              {pdfError && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>Error al generar PDF</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', maxWidth: 400, textAlign: 'center' }}>{pdfError}</div>
                  <button onClick={() => seleccionado && verPdf(seleccionado)}
                    style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    Reintentar
                  </button>
                </div>
              )}
              {pdfUrl && !pdfLoading && (
                <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
