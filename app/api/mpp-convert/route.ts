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
  if (!res.ok) throw new Error('No se pudo autenticar con Aspose')
  const data = await res.json()
  return data.access_token
}

// Convierte "2.16:00:00" o "08:00:00" a días laborables (8h/día)
function parseDuracionDias(dur: string | null): number {
  if (!dur) return 0
  try {
    const dotIdx = dur.indexOf('.')
    let days = 0, timeStr = dur
    if (dotIdx !== -1) {
      days    = parseInt(dur.slice(0, dotIdx)) || 0
      timeStr = dur.slice(dotIdx + 1)
    }
    const parts = timeStr.split(':').map(Number)
    const hours = (parts[0] ?? 0) + (parts[1] ?? 0) / 60
    return Math.round((days + hours / 8) * 10) / 10
  } catch {
    return 0
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const fileBuffer = await file.arrayBuffer()
    const token = await getAsposeToken()

    // 1a. Guardar en Supabase Storage para conversión PDF posterior
    await supabaseAdmin.storage
      .from('mpp-files')
      .upload(file.name, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true,
      })

    // 1b. Subir el archivo a Aspose Storage
    const uploadRes = await fetch(
      `https://api.aspose.cloud/v3.0/tasks/storage/file/${encodeURIComponent(file.name)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fileBuffer,
      }
    )
    if (!uploadRes.ok) throw new Error('Error subiendo archivo a Aspose')

    // 2. Obtener lista básica de tareas (UIDs + datos base)
    const tasksRes = await fetch(
      `https://api.aspose.cloud/v3.0/tasks/${encodeURIComponent(file.name)}/tasks`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!tasksRes.ok) throw new Error('Error obteniendo tareas')
    const tasksData = await tasksRes.json()

    const taskItems: any[] = tasksData.Tasks?.TaskItem ?? []

    // 3. Obtener detalle completo en paralelo (incluye PercentComplete, OutlineLevel, Summary)
    //    Limitamos a 200 tareas para no exceder rate limits de Aspose
    const BATCH = 200
    const slice = taskItems.slice(0, BATCH)

    const detalles = await Promise.all(
      slice.map(async (t: any) => {
        try {
          const r = await fetch(
            `https://api.aspose.cloud/v3.0/tasks/${encodeURIComponent(file.name)}/tasks/${t.Uid}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (!r.ok) return null
          const d = await r.json()
          return d.Task ?? d.task ?? null
        } catch {
          return null
        }
      })
    )

    // 4. Combinar datos base + detalles
    const tareas = slice
      .map((base: any, i: number) => {
        const det = detalles[i]
        const nombre = det?.Name ?? det?.name ?? base.Name ?? base.name ?? ''
        if (!nombre || nombre === 'New Task') return null

        const avance = Math.round(
          det?.PercentComplete ?? det?.percentComplete ??
          det?.PercentWorkComplete ?? det?.percentWorkComplete ?? 0
        )

        // Duraciones
        const durCalRaw = det?.Duration    ?? det?.duration    ?? base.Duration ?? null
        const durLabRaw = det?.Work        ?? det?.work        ?? null
        const diasCal   = parseDuracionDias(durCalRaw)
        const diasLab   = parseDuracionDias(durLabRaw)

        // Predecesores: array de UIDs o string
        const predsRaw  = det?.PredecessorTasks ?? det?.predecessorTasks ?? []
        const predIds   = Array.isArray(predsRaw)
          ? predsRaw.map((p: any) => p.Id ?? p.id ?? p.Uid ?? p.uid).filter(Boolean).join(', ')
          : String(predsRaw || '')

        // Costo parcial
        const costo = det?.Cost ?? det?.cost ?? det?.RemainingCost ?? null

        // Recursos
        const recursosRaw = det?.ResourceAssignments ?? det?.resourceAssignments ?? []
        const recursos = Array.isArray(recursosRaw)
          ? recursosRaw.map((r: any) => r.ResourceName ?? r.resourceName ?? '').filter(Boolean).join(', ')
          : ''

        // WBS / Item
        const wbs = det?.OutlineNumber ?? det?.outlineNumber ?? det?.WbsCode ?? det?.wbsCode ?? ''

        return {
          id:         base.Uid,
          wbs,
          nombre,
          inicio:     (det?.Start ?? base.Start)?.split('T')[0]  ?? null,
          fin:        (det?.Finish ?? base.Finish)?.split('T')[0] ?? null,
          avance,
          dias_cal:   diasCal,
          dias_lab:   diasLab > 0 ? diasLab : diasCal,
          predecesores: predIds,
          costo:      costo ? Math.round(Number(costo) * 100) / 100 : null,
          recursos,
          es_resumen: !!(det?.Summary ?? det?.summary ?? det?.IsSummary ?? false),
          nivel:      det?.OutlineLevel ?? det?.outlineLevel ?? 0,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ tareas, total: taskItems.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
