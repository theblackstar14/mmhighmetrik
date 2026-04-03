'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import InputRUC from './InputRUC'
import TipoCambio from './TipoCambio'
import type { DatosRUC } from '@/lib/sunat'
import type { FacturaRow, ProyectoOpcion, ProveedorOpcion } from '@/lib/facturacion'

interface Props {
  tipo:        'emitida' | 'recibida'
  proyectos:   ProyectoOpcion[]
  proveedores: ProveedorOpcion[]
  factura?:    FacturaRow | null   // si viene → modo edición
  empresaId:   string
  onClose:     () => void
}

const TIPOS_COMP = [
  { cod: '01', label: 'Factura' },
  { cod: '03', label: 'Boleta de venta' },
  { cod: '07', label: 'Nota de crédito' },
  { cod: '08', label: 'Nota de débito' },
]

const IGV_RATE = 0.18

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 12px', border: '1.5px solid #E2E8F0',
    borderRadius: 8, fontSize: 13, color: '#0F172A',
    background: '#fff', outline: 'none',
    ...extra,
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{children}</label>
}

export default function ModalFactura({ tipo, proyectos, proveedores, factura, empresaId, onClose }: Props) {
  const router  = useRouter()
  const editing = !!factura

  const [ruc,          setRuc]          = useState(factura?.ruc_contraparte  ?? '')
  const [nombre,       setNombre]       = useState(factura?.nombre_contraparte ?? '')
  const [tipoPersona,  setTipoPersona]  = useState<'JURIDICA' | 'NATURAL' | ''>('')
  const [tipoComp,     setTipoComp]     = useState('01')
  const [serie,        setSerie]        = useState(() => {
    if (factura?.serie_numero) return factura.serie_numero.split('-')[0] ?? ''
    return tipo === 'emitida' ? 'F001' : ''
  })
  const [numero,       setNumero]       = useState(() => {
    if (factura?.serie_numero) return factura.serie_numero.split('-')[1] ?? ''
    return ''
  })
  const [proyectoId,   setProyectoId]   = useState(factura?.proyecto_id  ?? '')
  const [proveedorId,  setProveedorId]  = useState(factura?.proveedor_id ?? '')
  const [subtotal,     setSubtotal]     = useState(factura?.subtotal.toString()  ?? '')
  const [igv,          setIgv]          = useState(factura?.igv.toString()       ?? '')
  const [total,        setTotal]        = useState(factura?.total.toString()      ?? '')
  const [moneda,       setMoneda]       = useState(factura?.moneda    ?? 'PEN')
  const [tipoCambio,   setTipoCambio]   = useState(factura?.tipo_cambio?.toString() ?? '')
  const [estado,       setEstado]       = useState(factura?.estado    ?? 'pendiente')
  const [fechaEmision, setFechaEmision] = useState(factura?.fecha_emision    ?? new Date().toISOString().split('T')[0])
  const [fechaVenc,    setFechaVenc]    = useState(factura?.fecha_vencimiento ?? '')
  const [fechaPago,    setFechaPago]    = useState(factura?.fecha_pago        ?? '')
  const [notas,        setNotas]        = useState(factura?.notas             ?? '')
  const [sunatFailed,  setSunatFailed]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  function handleSubtotalChange(val: string) {
    setSubtotal(val)
    const sub = parseFloat(val) || 0
    const igvCalc = Math.round(sub * IGV_RATE * 100) / 100
    setIgv(igvCalc.toString())
    setTotal((sub + igvCalc).toString())
  }

  function handleDatosRUC(datos: (DatosRUC & { tipo?: string }) | null) {
    if (datos) {
      setNombre(datos.nombre)
      setTipoPersona((datos.tipo === 'JURIDICA' || datos.tipo === 'NATURAL') ? datos.tipo : '')
      setSunatFailed(false)
    }
  }

  function handleSunatError(_err: string) {
    setSunatFailed(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!serie || !numero) { setError('Serie y número son requeridos'); return }
    if (!nombre)           { setError('La razón social es requerida — ingrésala manualmente si SUNAT no respondió'); return }
    if (!subtotal)         { setError('El subtotal es requerido'); return }

    setSaving(true)
    setError('')

    const supabase = createClient()
    const payload  = {
      empresa_id:          empresaId,
      tipo,
      serie_numero:        `${serie}-${numero}`,
      proyecto_id:         proyectoId  || null,
      proveedor_id:        tipo === 'recibida' ? (proveedorId || null) : null,
      ruc_contraparte:     ruc  || null,
      nombre_contraparte:  nombre || null,
      subtotal:            parseFloat(subtotal) || 0,
      igv:                 parseFloat(igv)      || 0,
      total:               parseFloat(total)    || 0,
      moneda,
      tipo_cambio:         moneda === 'USD' ? (parseFloat(tipoCambio) || null) : null,
      estado,
      fecha_emision:       fechaEmision,
      fecha_vencimiento:   fechaVenc  || null,
      fecha_pago:          (estado === 'pagada' && fechaPago) ? fechaPago : null,
      notas:               notas || null,
    }

    const { error: dbErr } = editing
      ? await supabase.from('factura').update(payload).eq('id', factura!.id)
      : await supabase.from('factura').insert(payload)

    if (dbErr) { setError(dbErr.message); setSaving(false); return }

    router.refresh()
    onClose()
  }

  const esUSD   = moneda === 'USD'
  const totalNum = parseFloat(total) || 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,.25)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
              {editing ? 'Editar factura' : tipo === 'emitida' ? 'Nueva factura emitida' : 'Registrar factura recibida'}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {tipo === 'emitida' ? 'Cobros a clientes' : 'Pagos a proveedores'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', padding: 4 }}>×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* RUC */}
          <InputRUC
            value={ruc}
            onChange={(v) => { setRuc(v); if (v.length < 11) setSunatFailed(false) }}
            onDatosRUC={handleDatosRUC}
            onSunatError={handleSunatError}
            label={tipo === 'emitida' ? 'RUC del cliente' : 'RUC del proveedor'}
            placeholder="20601234567"
          />

          {/* Razón social / Nombre — label dinámico según tipo de persona */}
          <div>
            <Label>
              {tipoPersona === 'JURIDICA'
                ? (tipo === 'emitida' ? 'Razón social cliente' : 'Razón social proveedor')
                : tipoPersona === 'NATURAL'
                ? (tipo === 'emitida' ? 'Nombre cliente' : 'Nombre proveedor')
                : (tipo === 'emitida' ? 'Razón social / Nombre cliente' : 'Razón social / Nombre proveedor')
              }{' '}
              <span style={{ color: '#EF4444' }}>*</span>
              {tipoPersona === 'JURIDICA' && (
                <span style={{ fontSize: 10, fontWeight: 400, color: '#6B7280', marginLeft: 6 }}>Persona jurídica</span>
              )}
              {tipoPersona === 'NATURAL' && (
                <span style={{ fontSize: 10, fontWeight: 400, color: '#6B7280', marginLeft: 6 }}>Persona natural</span>
              )}
              {sunatFailed && (
                <span style={{ fontWeight: 400, color: '#D97706', marginLeft: 6 }}>↑ ingresa manualmente</span>
              )}
            </Label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder={sunatFailed ? 'Escribe la razón social aquí' : 'Se completa automáticamente con el RUC'}
              style={inputStyle(sunatFailed && !nombre ? { borderColor: '#F59E0B', background: '#FFFBEB' } : {})}
            />
          </div>

          {/* Tipo comprobante + serie + numero */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <Label>Tipo comprobante</Label>
              <select value={tipoComp} onChange={e => setTipoComp(e.target.value)} style={inputStyle()}>
                {TIPOS_COMP.map(t => <option key={t.cod} value={t.cod}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Serie</Label>
              <input value={serie} onChange={e => setSerie(e.target.value.toUpperCase())} placeholder="F001" style={inputStyle()} />
            </div>
            <div>
              <Label>Número</Label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="00000001" style={inputStyle()} />
            </div>
          </div>

          {/* Proyecto + Proveedor */}
          <div style={{ display: 'grid', gridTemplateColumns: tipo === 'recibida' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div>
              <Label>Proyecto (opcional)</Label>
              <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} style={inputStyle()}>
                <option value="">— Sin proyecto —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
              </select>
            </div>
            {tipo === 'recibida' && (
              <div>
                <Label>Proveedor (opcional)</Label>
                <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={inputStyle()}>
                  <option value="">— Sin proveedor —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Moneda */}
          <div>
            <Label>Moneda</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['PEN', 'USD'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMoneda(m)} style={{
                  padding: '7px 20px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${moneda === m ? '#2563EB' : '#E2E8F0'}`,
                  background: moneda === m ? '#EFF6FF' : '#fff',
                  color: moneda === m ? '#2563EB' : '#64748B',
                  transition: 'all .15s',
                }}>
                  {m === 'PEN' ? 'S/ Soles' : '$ Dólares'}
                </button>
              ))}
            </div>
          </div>

          {/* TC si es USD */}
          {esUSD && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <Label>Tipo de cambio</Label>
                <input type="number" step="0.001" value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} placeholder="3.750" style={inputStyle()} />
              </div>
              <TipoCambio compact />
            </div>
          )}

          {/* Montos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <Label>Subtotal {moneda === 'USD' ? '(USD)' : '(PEN)'}</Label>
              <input type="number" step="0.01" value={subtotal} onChange={e => handleSubtotalChange(e.target.value)} placeholder="0.00" style={inputStyle()} />
            </div>
            <div>
              <Label>IGV (18%)</Label>
              <input type="number" step="0.01" value={igv} onChange={e => setIgv(e.target.value)} placeholder="0.00" style={inputStyle({ background: '#F8FAFC' })} />
            </div>
            <div>
              <Label>Total</Label>
              <input type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00" style={inputStyle({ fontWeight: 700 })} />
            </div>
          </div>

          {/* Conversión USD→PEN */}
          {esUSD && totalNum > 0 && (
            <TipoCambio monto={totalNum} moneda="USD" />
          )}

          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <Label>Fecha emisión</Label>
              <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <Label>Fecha vencimiento</Label>
              <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} style={inputStyle()} />
            </div>
          </div>

          {/* Estado */}
          <div>
            <Label>Estado</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['pendiente','pagada','vencida','anulada'].map(s => (
                <button key={s} type="button" onClick={() => setEstado(s)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${estado === s ? '#0F172A' : '#E2E8F0'}`,
                  background: estado === s ? '#0F172A' : '#fff',
                  color: estado === s ? '#fff' : '#64748B',
                  transition: 'all .15s', textTransform: 'capitalize',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label>Notas (opcional)</Label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Observaciones, referencia de OC, etc." style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, color: '#DC2626' }}>{error}</div>
          )}
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit as any} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saving ? '#94A3B8' : '#0F172A', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', transition: 'background .15s' }}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
