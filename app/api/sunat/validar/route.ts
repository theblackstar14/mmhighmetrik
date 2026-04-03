import type { NextRequest } from 'next/server'
import { validarComprobante } from '@/lib/sunat'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rucEmisor, tipoComp, serie, numero, monto, fechaEmision } = body

    if (!rucEmisor || !tipoComp || !serie || !numero || !monto || !fechaEmision) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const resultado = await validarComprobante({ rucEmisor, tipoComp, serie, numero, monto, fechaEmision })
    return Response.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error validando comprobante'
    return Response.json({ error: msg }, { status: 502 })
  }
}
