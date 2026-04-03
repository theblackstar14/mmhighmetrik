/**
 * Cliente SUNAT — solo se ejecuta en el servidor.
 * Variables de entorno requeridas:
 *   SUNAT_RUC          RUC de la empresa (11 dígitos)
 *   SUNAT_USUARIO_SOL  Usuario SOL (ej. MODDATOS)
 *   SUNAT_CLAVE_SOL    Clave SOL
 */

// ── Token cache (en memoria, válido por proceso) ─────────────
let tokenCache: { value: string; expiresAt: number } | null = null

async function getSunatToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value
  }

  const ruc      = process.env.SUNAT_RUC!
  const usuario  = process.env.SUNAT_USUARIO_SOL!
  const clave    = process.env.SUNAT_CLAVE_SOL!

  if (!ruc || !usuario || !clave) {
    throw new Error('Faltan variables de entorno SUNAT_RUC / SUNAT_USUARIO_SOL / SUNAT_CLAVE_SOL')
  }

  const res = await fetch(
    `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/oauth2/token/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        scope:         'contribuyentes',
        client_id:     ruc,
        client_secret: clave,
        username:      `${ruc}${usuario}`,
        password:      clave,
      }),
    }
  )

  if (!res.ok) {
    const txt = await res.text()
    const hint = res.status === 401
      ? ' (credenciales incorrectas o cuenta no habilitada para API)'
      : res.status === 400
      ? ' (parámetros OAuth incorrectos)'
      : ''
    throw new Error(`SUNAT OAuth ${res.status}${hint}: ${txt}`)
  }

  const json = await res.json()
  tokenCache = {
    value:     json.access_token,
    expiresAt: Date.now() + (json.expires_in - 30) * 1000,
  }
  return tokenCache.value
}

// ── Consulta RUC ─────────────────────────────────────────────

export interface DatosRUC {
  ruc:                  string
  nombre:               string         // razon_social de decolecta
  tipo:                 string         // JURIDICA | NATURAL (derivado del prefijo del RUC)
  tipoEmpresa?:         string         // SOCIEDAD ANONIMA CERRADA | EMPRESA INDIVIDUAL | ...
  estado:               string         // ACTIVO | BAJA DE OFICIO | ...
  condicion:            string         // HABIDO | NO HABIDO | ...
  direccion:            string
  distrito:             string
  provincia:            string
  departamento:         string
  esAgenteRetencion:    boolean
  esBuenContribuyente:  boolean
  actividadEconomica?:  string
  numeroTrabajadores?:  string
  tipoFacturacion?:     string
  comercioExterior?:    string
}

export async function consultarRUC(ruc: string): Promise<DatosRUC> {
  if (!/^\d{11}$/.test(ruc)) throw new Error('RUC debe tener 11 dígitos')

  const token = await getSunatToken()

  const res = await fetch(
    `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next:    { revalidate: 86400 }, // cachear 24h — los datos de RUC cambian poco
    }
  )

  if (res.status === 404) throw new Error('RUC no encontrado en SUNAT')
  if (!res.ok) throw new Error(`SUNAT error ${res.status}`)

  const d = await res.json()

  // Normalizar campos (SUNAT usa distintas claves según versión de API)
  return {
    ruc:                 d.numRUC          ?? d.ruc           ?? ruc,
    nombre:              d.nomRazonSocial  ?? d.nombre        ?? '—',
    tipo:                ruc.startsWith('20') ? 'JURIDICA' : ruc.startsWith('10') ? 'NATURAL' : '—',
    estado:              d.desSunatEstado  ?? d.estadoContribuyente       ?? '—',
    condicion:           d.desSunatCondDom ?? d.condicionContribuyente    ?? '—',
    direccion:           [d.nomCalle, d.codNum, d.desTipoZona, d.nomZona].filter(Boolean).join(' '),
    distrito:            d.nomDist         ?? d.distrito      ?? '—',
    provincia:           d.nomProv         ?? d.provincia     ?? '—',
    departamento:        d.nomDpto         ?? d.departamento  ?? '—',
    esAgenteRetencion:   d.indEmisorElec === '1' || d.esAgenteRetencion === true,
    esBuenContribuyente: d.esBuenContribuyente === true,
  }
}

// ── Tipo de cambio ────────────────────────────────────────────

export interface TipoCambio {
  fecha:  string   // DD/MM/YYYY
  compra: number
  venta:  number
}

export async function getTipoCambio(): Promise<TipoCambio> {
  // SUNAT publica el TC diario como texto plano — no requiere auth
  const res = await fetch('https://www.sunat.gob.pe/a/txt/tipoCambio.txt', {
    next: { revalidate: 3600 }, // refrescar cada hora
  })

  if (!res.ok) throw new Error(`SUNAT TC error ${res.status}`)

  const text = (await res.text()).trim()
  // Formato: DD/MM/YYYY|COMPRA|VENTA  (ej. 02/04/2026|3.700|3.710)
  const [fecha, compra, venta] = text.split('|')

  return {
    fecha:  fecha ?? '—',
    compra: parseFloat(compra ?? '0'),
    venta:  parseFloat(venta  ?? '0'),
  }
}

// ── Validar comprobante ───────────────────────────────────────

export interface ResultadoValidacion {
  valido:      boolean
  estado:      string
  descripcion: string
}

export async function validarComprobante(params: {
  rucEmisor:    string
  tipoComp:     string  // '01'=factura, '03'=boleta, '07'=N.crédito, '08'=N.débito
  serie:        string  // ej. F001
  numero:       string  // ej. 00000042
  monto:        number
  fechaEmision: string  // DD/MM/YYYY
}): Promise<ResultadoValidacion> {
  const token = await getSunatToken()

  const res = await fetch(
    `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${params.rucEmisor}/validarcomprobante`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        numRuc:        params.rucEmisor,
        codComp:       params.tipoComp,
        numeroSerie:   params.serie,
        numero:        params.numero,
        monto:         params.monto.toFixed(2),
        fechaEmision:  params.fechaEmision,
      }),
    }
  )

  if (!res.ok) {
    return { valido: false, estado: 'ERROR', descripcion: `Error SUNAT ${res.status}` }
  }

  const d = await res.json()
  const estado = d.estadoCp ?? d.estado ?? '—'
  const valido = estado === '1' || estado === 'ACEPTADO'

  return {
    valido,
    estado,
    descripcion: d.sunatDescription ?? d.descripcion ?? estado,
  }
}
