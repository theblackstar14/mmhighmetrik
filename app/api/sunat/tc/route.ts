import { getTipoCambio } from '@/lib/sunat'

export async function GET() {
  try {
    const tc = await getTipoCambio()
    return Response.json(tc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error obteniendo tipo de cambio'
    return Response.json({ error: msg }, { status: 502 })
  }
}
