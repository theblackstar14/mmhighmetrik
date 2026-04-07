import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ASPOSE_CLIENT_ID     = process.env.ASPOSE_CLIENT_ID!
const ASPOSE_CLIENT_SECRET = process.env.ASPOSE_CLIENT_SECRET!

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAsposeToken(): Promise<string> {
  const res = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     ASPOSE_CLIENT_ID,
      client_secret: ASPOSE_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error('Error autenticando con Aspose')
  return (await res.json()).access_token
}

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get('file')
    if (!filename) return NextResponse.json({ error: 'Falta parámetro file' }, { status: 400 })

    const pdfCacheName = filename.replace(/\.mpp$/i, '.pdf')

    // 0. Verificar si ya existe PDF en caché
    const { data: cached } = await supabaseAdmin.storage
      .from('mpp-files')
      .download(`pdf-cache/${pdfCacheName}`)

    if (cached) {
      const buf = await cached.arrayBuffer()
      return new NextResponse(buf, {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `inline; filename="${pdfCacheName}"`,
          'Cache-Control':       'private, max-age=3600',
          'X-Cache':             'HIT',
        },
      })
    }

    const token = await getAsposeToken()

    // 1. Descargar MPP desde Supabase Storage
    const { data: mppData, error: storageErr } = await supabaseAdmin.storage
      .from('mpp-files')
      .download(filename)

    if (storageErr || !mppData) {
      throw new Error(`Archivo no encontrado en storage: ${storageErr?.message}`)
    }

    const mppBuffer = await mppData.arrayBuffer()

    // 2. Re-subir a Aspose Storage
    const uploadRes = await fetch(
      `https://api.aspose.cloud/v3.0/tasks/storage/file/${encodeURIComponent(filename)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: mppBuffer,
      }
    )
    if (!uploadRes.ok) throw new Error('Error subiendo a Aspose')

    // 3. Convertir MPP → PDF usando el endpoint /format
    const convertRes = await fetch(
      `https://api.aspose.cloud/v3.0/tasks/${encodeURIComponent(filename)}/format?format=Pdf`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!convertRes.ok) {
      const body = await convertRes.text()
      throw new Error(`Error convirtiendo (${convertRes.status}): ${body.slice(0, 300)}`)
    }

    const pdfBuffer = await convertRes.arrayBuffer()

    // Verificar que es un PDF real (%PDF header)
    const hdr   = new Uint8Array(pdfBuffer.slice(0, 4))
    const isPdf = hdr[0] === 0x25 && hdr[1] === 0x50 && hdr[2] === 0x44 && hdr[3] === 0x46
    if (!isPdf) {
      const preview = new TextDecoder().decode(pdfBuffer.slice(0, 400))
      throw new Error(`No es PDF válido. Respuesta: ${preview}`)
    }

    // Guardar PDF en caché para próximas solicitudes
    await supabaseAdmin.storage
      .from('mpp-files')
      .upload(`pdf-cache/${pdfCacheName}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${pdfCacheName}"`,
        'Cache-Control':       'private, max-age=3600',
        'X-Cache':             'MISS',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
