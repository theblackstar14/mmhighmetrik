import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

async function groqGenerate(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 8000))
      continue
    }
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq error ${res.status}: ${err.slice(0, 300)}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }
  throw new Error('Rate limit de Groq alcanzado tras 3 intentos')
}

function makePrompt(csv: string): string {
  return `Eres un experto en cotizaciones de construcción en Perú.
Analiza esta hoja y extrae los datos como JSON.

CONTENIDO:
${csv}

Devuelve SOLO el JSON, sin markdown, sin explicaciones:
{
  "numero_cot": "string",
  "revision": "string",
  "proyecto": "string",
  "cliente": "string",
  "ruc_empresa": "string",
  "contacto": "string",
  "telefono": "string",
  "elaborado_por": "string",
  "revisado_por": "string",
  "ubicacion": "string",
  "fecha": "string YYYY-MM-DD",
  "plazo_ejecucion": "string",
  "moneda": "PEN",
  "partidas": [
    {
      "item": "string",
      "descripcion": "string",
      "unidad": "string o null",
      "metrado": number o null,
      "precio_unitario": number o null,
      "parcial": number o null,
      "es_titulo": boolean
    }
  ],
  "subtotal": number,
  "igv": number,
  "total": number,
  "condiciones_comerciales": ["string"],
  "responsabilidades": ["string"],
  "facilidades": ["string"],
  "validez_dias": number o null,
  "forma_pago": "string o null"
}

Reglas:
- es_titulo=true para filas agrupadoras sin precio (ej: "01 ESTRUCTURAS")
- partidas solo incluye filas reales con item y descripcion
- números sin símbolos ni formato, solo dígitos
- Si un campo no existe usa null o cadena vacía`
}

function extractJson(raw: string): any | null {
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  const start = clean.indexOf('{')
  const end   = clean.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(clean.slice(start, end + 1)) } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer   = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })

    const cotizaciones: any[]   = []
    const hojas: string[]       = []
    const errores: Record<string, string> = {}

    const hojasConContenido = workbook.SheetNames.filter(name => {
      const ws  = workbook.Sheets[name]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      return csv.trim().length > 20
    })

    if (hojasConContenido.length === 0)
      return NextResponse.json({ error: 'Archivo vacío o sin contenido legible' }, { status: 400 })

    for (let idx = 0; idx < hojasConContenido.length; idx++) {
      const sheetName = hojasConContenido[idx]
      hojas.push(sheetName)

      // Pequeña pausa entre llamadas para no saturar el rate limit
      if (idx > 0) await new Promise(r => setTimeout(r, 2000))

      const ws  = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })

      try {
        const rawText = await groqGenerate(makePrompt(csv.slice(0, 20000)))
        const parsed  = extractJson(rawText)
        if (parsed) {
          cotizaciones.push({ ...parsed, _hoja: sheetName })
        } else {
          errores[sheetName] = 'No se pudo extraer JSON de la respuesta'
        }
      } catch (e: any) {
        errores[sheetName] = e.message
      }
    }

    if (cotizaciones.length === 0)
      return NextResponse.json({
        error: `No se pudo parsear ninguna hoja. Errores: ${JSON.stringify(errores)}`,
      }, { status: 400 })

    return NextResponse.json({ cotizaciones, hojas, errores })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
