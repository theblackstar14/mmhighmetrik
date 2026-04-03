import type { NextRequest } from 'next/server'
import type { DatosRUC } from '@/lib/sunat'

// Usamos el endpoint /full para obtener tipo de empresa, actividad, trabajadores, etc.
const BASE_URL = 'https://api.decolecta.com/v1/sunat/ruc/full'

export async function GET(request: NextRequest) {
  const numero = request.nextUrl.searchParams.get('numero') ?? ''

  if (!/^\d{11}$/.test(numero)) {
    return Response.json({ error: 'RUC debe tener 11 dígitos' }, { status: 400 })
  }

  const token = process.env.APIS_NET_PE_TOKEN
  if (!token) {
    return Response.json(
      { error: 'Variable APIS_NET_PE_TOKEN no configurada en .env.local' },
      { status: 503 }
    )
  }

  const res = await fetch(`${BASE_URL}?numero=${numero}`, {
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${token}`,
    },
    next: { revalidate: 86400 }, // cachear 24h — los datos de RUC cambian poco
  })

  if (res.status === 404) {
    return Response.json({ error: 'RUC no encontrado en SUNAT' }, { status: 404 })
  }
  if (res.status === 401) {
    return Response.json({ error: 'Token inválido o expirado — verifica APIS_NET_PE_TOKEN' }, { status: 401 })
  }
  if (res.status === 422) {
    const j = await res.json().catch(() => ({}))
    return Response.json({ error: j.error ?? 'Formato de RUC inválido' }, { status: 422 })
  }
  if (!res.ok) {
    const txt = await res.text()
    return Response.json({ error: `Error ${res.status}: ${txt}` }, { status: 502 })
  }

  const d = await res.json()

  // Tipo de persona por prefijo de RUC (10=natural, 20=jurídica)
  const esJuridica = numero.startsWith('20')
  const esNatural  = numero.startsWith('10')

  const datos: DatosRUC = {
    ruc:                 d.numero_documento   ?? numero,
    nombre:              d.razon_social       ?? '—',
    tipo:                esJuridica ? 'JURIDICA' : esNatural ? 'NATURAL' : '—',
    tipoEmpresa:         d.tipo               ?? undefined,
    estado:              d.estado             ?? '—',
    condicion:           d.condicion          ?? '—',
    direccion:           d.direccion          ?? '',
    distrito:            d.distrito           ?? '',
    provincia:           d.provincia          ?? '',
    departamento:        d.departamento       ?? '',
    esAgenteRetencion:   d.es_agente_retencion    === true,
    esBuenContribuyente: d.es_buen_contribuyente  === true,
    actividadEconomica:  d.actividad_economica ?? undefined,
    numeroTrabajadores:  d.numero_trabajadores  ?? undefined,
    tipoFacturacion:     d.tipo_facturacion    ?? undefined,
    comercioExterior:    d.comercio_exterior   ?? undefined,
  }

  return Response.json(datos)
}
