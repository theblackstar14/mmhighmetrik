import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ColMap { item:number; descripcion:number; unidad:number; metrado:number; precio:number; parcial:number; total:number }
interface TreeNode {
  codigo: string; descripcion: string; unidad: string|null
  metrado: number|null; precio_unitario: number|null
  parcial: number|null; total: number|null; children: TreeNode[]
}

// ── Constantes ────────────────────────────────────────────────────────────────
const SKIP_SHEETS = new Set(['hoja1','portada','indice','resumen'])
const ITEM_RE     = /^\d{2}(\.\d{2})*\.?$/
const SUMMARY_RE  = /GASTOS\s*GENERALES|UTILIDAD|G\.G\b|G\.U\b|IGV|I\.G\.V|CRONOGRAMA|ADMINISTR|SEGURIDAD|IMPUESTO/i

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseNum  = (v: any) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? null : n }
const cleanCode = (c: any) => String(c ?? '').trim().replace(/\.$/, '')

function detectCols(header: any[]): ColMap {
  const m: ColMap = { item:-1, descripcion:-1, unidad:-1, metrado:-1, precio:-1, parcial:-1, total:-1 }
  header.forEach((cell, i) => {
    const h = String(cell ?? '').toUpperCase().trim()
    if (h.includes('ITEM'))                                                m.item        = i
    if (h.includes('DESCRIP'))                                             m.descripcion = i
    if (h.includes('UNID'))                                                m.unidad      = i
    if (h.includes('MET') || h.includes('METRAD') || h.includes('CANT'))  m.metrado     = i
    if (h.includes('PRECIO') || h.includes('P.U')  || h.includes('UNIT')) m.precio      = i
    if (h.includes('PARCIAL'))                                             m.parcial     = i
    if (h.includes('TOTAL'))                                               m.total       = i
  })
  return m
}

function buildTree(flat: TreeNode[]): TreeNode[] {
  const roots: TreeNode[] = []
  const stack: TreeNode[] = []
  for (const item of flat) {
    while (stack.length > 0 && !item.codigo.startsWith(stack[stack.length - 1].codigo + '.')) stack.pop()
    if (stack.length === 0) roots.push(item)
    else stack[stack.length - 1].children.push(item)
    stack.push(item)
  }
  return roots
}

function flattenTree(nodes: TreeNode[], out: any[] = []): any[] {
  for (const n of nodes) {
    out.push({
      item:            n.codigo,
      descripcion:     n.descripcion,
      unidad:          n.unidad,
      metrado:         n.metrado,
      precio_unitario: n.precio_unitario,
      parcial:         n.parcial ?? n.total,
      es_titulo:       n.children.length > 0,
    })
    if (n.children.length > 0) flattenTree(n.children, out)
  }
  return out
}

function extractMeta(rows: any[][], headerIdx: number) {
  const m = { proyecto:'', cliente:'', fecha:'', numero_cot:'', ruc_empresa:'' }
  for (const row of rows.slice(0, headerIdx)) {
    const line = row.map((c: any) => String(c ?? '')).join(' ')
    if (!m.proyecto)   { const r = line.match(/PROYECTO[:\s]+(.+)/i);                          if (r) m.proyecto   = r[1].trim() }
    if (!m.cliente)    { const r = line.match(/CLIENTE[:\s]+(.+)/i);                           if (r) m.cliente    = r[1].trim() }
    if (!m.fecha)      { const r = line.match(/FECHA[:\s]+(.+)/i);                             if (r) m.fecha      = r[1].trim() }
    if (!m.numero_cot) { const r = line.match(/(?:COT|N[°ºo]|N[uú]m)[.\s\-]*([A-Z0-9\-]+)/i); if (r) m.numero_cot = r[1].trim() }
    if (!m.ruc_empresa){ const r = line.match(/RUC[:\s]+(\d{11})/i);                           if (r) m.ruc_empresa = r[1].trim() }
  }
  return m
}

function extractFinancials(tree: TreeNode[]) {
  function flat(arr: TreeNode[]): TreeNode[] {
    return arr.reduce((r, i) => { r.push(i); if (i.children.length) r.push(...flat(i.children)); return r }, [] as TreeNode[])
  }
  const all = flat(tree)
  const igvRow   = all.find(i => /IGV|I\.G\.V/i.test(i.descripcion))
  const totalRow = all.find(i => /^\s*TOTAL\s*$/i.test(i.descripcion))
  const igv      = igvRow   ? (igvRow.parcial   ?? igvRow.total   ?? 0) : 0
  const total    = totalRow ? (totalRow.parcial ?? totalRow.total ?? 0) : 0
  const rootSum  = tree.filter(i => !SUMMARY_RE.test(i.descripcion))
                        .reduce((s, i) => s + (i.parcial ?? i.total ?? 0), 0)
  const subtotal = total > 0 ? total - igv : rootSum
  return { subtotal, igv, total: total > 0 ? total : subtotal + igv }
}

function toIsoDate(val: string): string {
  if (!val) return ''
  const m = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return val
}

// ── Parser determinístico ─────────────────────────────────────────────────────
function parseSheetDeterministic(sheetName: string, rows: any[][]): any | null {
  // Detectar fila header
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const up = rows[i].map((c: any) => String(c ?? '').toUpperCase())
    if (up.some(c => c.includes('ITEM')) && up.some(c => c.includes('PARCIAL') || c.includes('TOTAL'))) {
      headerIdx = i; break
    }
  }
  if (headerIdx === -1) return null

  const cols     = detectCols(rows[headerIdx])
  const dataRows = rows.slice(headerIdx + 1)
  const validRows = dataRows.filter(r => ITEM_RE.test(cleanCode(r[cols.item] ?? '')))

  if (validRows.length < 2) return null
  const withDesc = validRows.filter(r => String(r[cols.descripcion] ?? '').trim().length > 0)
  if (withDesc.length / validRows.length < 0.4) return null

  // Construir nodos
  const flat: TreeNode[] = []
  for (const row of dataRows) {
    const code = cleanCode(row[cols.item] ?? '')
    if (!ITEM_RE.test(code)) continue
    flat.push({
      codigo:          code,
      descripcion:     String(row[cols.descripcion] ?? '').trim(),
      unidad:          cols.unidad  >= 0 ? (String(row[cols.unidad]  ?? '').trim() || null) : null,
      metrado:         cols.metrado >= 0 ? parseNum(row[cols.metrado]) : null,
      precio_unitario: cols.precio  >= 0 ? parseNum(row[cols.precio])  : null,
      parcial:         cols.parcial >= 0 ? parseNum(row[cols.parcial]) : null,
      total:           cols.total   >= 0 ? parseNum(row[cols.total])   : null,
      children: [],
    })
  }

  const tree     = buildTree(flat)
  const partidas = flattenTree(tree)
  const meta     = extractMeta(rows, headerIdx)
  const fin      = extractFinancials(tree)

  return {
    numero_cot:             meta.numero_cot || sheetName,
    revision:               '1.00',
    proyecto:               meta.proyecto   || '',
    cliente:                meta.cliente    || '',
    ruc_empresa:            meta.ruc_empresa || '',
    contacto:               '',
    telefono:               '',
    elaborado_por:          '',
    revisado_por:           '',
    ubicacion:              '',
    fecha:                  toIsoDate(meta.fecha),
    plazo_ejecucion:        '',
    moneda:                 'PEN',
    partidas,
    subtotal:               fin.subtotal,
    igv:                    fin.igv,
    total:                  fin.total,
    condiciones_comerciales:[],
    responsabilidades:      [],
    facilidades:            [],
    validez_dias:           null,
    forma_pago:             null,
    _hoja:                  sheetName,
    _metodo:                'deterministic',
  }
}

// ── Groq fallback ─────────────────────────────────────────────────────────────
async function groqFallback(csv: string, sheetName: string): Promise<any | null> {
  if (!process.env.GROQ_API_KEY) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 8192,
        messages: [{ role: 'user', content: `Eres un experto en cotizaciones de construcción en Perú.
Analiza esta hoja y extrae los datos como JSON.
CONTENIDO:
${csv.slice(0, 20000)}
Devuelve SOLO el JSON sin markdown:
{"numero_cot":"","revision":"1.00","proyecto":"","cliente":"","ruc_empresa":"","contacto":"","telefono":"","elaborado_por":"","revisado_por":"","ubicacion":"","fecha":"YYYY-MM-DD","plazo_ejecucion":"","moneda":"PEN","partidas":[{"item":"","descripcion":"","unidad":null,"metrado":null,"precio_unitario":null,"parcial":null,"es_titulo":false}],"subtotal":0,"igv":0,"total":0,"condiciones_comerciales":[],"responsabilidades":[],"facilidades":[],"validez_dias":null,"forma_pago":null}
Reglas: es_titulo=true para filas sin precio. números sin símbolos.` }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    let raw = (data.choices?.[0]?.message?.content ?? '').replace(/```json\s*/gi,'').replace(/```\s*/gi,'').trim()
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
    if (s === -1 || e === -1) return null
    return { ...JSON.parse(raw.slice(s, e + 1)), _hoja: sheetName, _metodo: 'groq' }
  } catch { return null }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const buffer   = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })

    const cotizaciones: any[] = []
    const errores: Record<string, string> = {}

    const hojasUtiles = workbook.SheetNames.filter(name => {
      if (SKIP_SHEETS.has(name.toLowerCase())) return false
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })
      return csv.trim().length > 20
    })

    if (hojasUtiles.length === 0)
      return NextResponse.json({ error: 'Archivo vacío o sin contenido legible' }, { status: 400 })

    for (let i = 0; i < hojasUtiles.length; i++) {
      const sheetName = hojasUtiles[i]
      const ws  = workbook.Sheets[sheetName]

      // Matriz cruda limpia
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const rows = rawRows
        .map(r => r.map((c: any) => typeof c === 'string' ? c.trim() : c))
        .filter(r => r.some((c: any) => c !== '' && c != null))

      // 1) Intento determinístico
      const det = parseSheetDeterministic(sheetName, rows)
      if (det) {
        cotizaciones.push(det)
        continue
      }

      // 2) Groq fallback (con pausa para no saturar RPM)
      if (i > 0) await new Promise(r => setTimeout(r, 1500))
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
      const groq = await groqFallback(csv, sheetName)
      if (groq) {
        cotizaciones.push(groq)
      } else {
        errores[sheetName] = 'No se pudo parsear (formato no reconocido)'
      }
    }

    if (cotizaciones.length === 0)
      return NextResponse.json({ error: `Sin cotizaciones parseables. ${JSON.stringify(errores)}` }, { status: 400 })

    return NextResponse.json({ cotizaciones, errores })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
