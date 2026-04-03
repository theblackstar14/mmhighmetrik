'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  proyectoId: string
  onUploaded: (url: string) => void
}

export default function SubirPortada({ proyectoId, onUploaded }: Props) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_MB = 5
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Máximo ${MAX_MB} MB`)
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const ext      = file.name.split('.').pop() ?? 'jpg'
    const path     = `${proyectoId}/portada.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('proyectos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Error al subir. Verifica el bucket en Supabase.')
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('proyectos')
      .getPublicUrl(path)

    await supabase
      .from('proyecto')
      .update({ imagen_url: publicUrl })
      .eq('id', proyectoId)

    onUploaded(publicUrl)
    setLoading(false)
    // reset input so the same file can be re-selected
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        title={error ?? 'Cambiar portada'}
        onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
        disabled={loading}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: loading ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.45)',
          border: error ? '2px solid #F87171' : '1.5px solid rgba(255,255,255,.35)',
          color: '#fff', fontSize: 15, cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          transition: 'background .15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.7)' }}
        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.45)' }}
      >
        {loading ? '⏳' : error ? '⚠' : '📷'}
      </button>
    </>
  )
}
