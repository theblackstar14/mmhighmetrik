'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { GastoRow, ProyectoOpcion } from '@/lib/facturacion'

const CENTROS = [
  { val: 'proyecto',  label: 'Proyecto',   desc: 'Imputable a una obra',            icon: '🏗️' },
  { val: 'oficina',   label: 'Oficina',    desc: 'Alquiler, luz, útiles, internet',  icon: '🏢' },
  { val: 'vehiculos', label: 'Vehículos',  desc: 'Combustible, mantenimiento',       icon: '🚚' },
  { val: 'almacen',   label: 'Almacén',    desc: 'EPP, herramientas, stock',         icon: '📦' },
  { val: 'personal',  label: 'Personal',   desc: 'Viáticos, capacitaciones',         icon: '👷' },
  { val: 'otros',     label: 'Otros',      desc: 'Misceláneos',                      icon: '📋' },
]

const CATEGORIAS = [
  { val: 'material',       label: 'Material' },
  { val: 'subcontrato',    label: 'Subcontrato' },
  { val: 'mano_obra',      label: 'Mano de obra' },
  { val: 'alquiler',       label: 'Alquiler / Equipo' },
  { val: 'administracion', label: 'Administración' },
  { val: 'impuesto',       label: 'Impuesto' },
]

// Placeholder de referencia según centro
const MEDIOS_PAGO = [
  { val: 'efectivo',      label: 'Efectivo',      desc: 'Caja chica' },
  { val: 'transferencia', label: 'Transferencia',  desc: 'Cuenta banco' },
  { val: 'cheque',        label: 'Cheque',         desc: 'Cheque banco' },
  { val: 'tarjeta',       label: 'Tarjeta',        desc: 'Débito / crédito' },
]

const REF_PLACEHOLDER: Record<string, string> = {
  proyecto:  'Ej: Excavadora CAT 320, Camión volquete ABC-123, Andamios…',
  vehiculos: 'Ej: Camioneta Placa ABC-123, Volquete XYZ-456…',
  almacen:   'Ej: Casco 3M lote 50 unid., Disco de corte…',
  personal:  'Ej: Viático Lima — Ing. García, Curso seguridad…',
  oficina:   'Ej: Laptop Lenovo, Resmas papel, etc.',
  otros:     'Detalle adicional opcional',
}

// Código del proyecto interno que corresponde a cada centro de costo
const CENTRO_CODIGO: Record<string, string> = {
  oficina:   'GG-OFICINA',
  vehiculos: 'GG-VEHICULOS',
  almacen:   'GG-ALMACEN',
  personal:  'GG-PERSONAL',
  otros:     'GG-OTROS',
}

interface Props {
  proyectos:  ProyectoOpcion[]
  gasto?:     GastoRow | null
  empresaId:  string
  onClose:    () => void
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, color: '#0F172A', background: '#fff', outline: 'none', ...extra }
}
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{children}</label>
}

export default function ModalGasto({ proyectos, gasto, empresaId, onClose }: Props) {
  const router  = useRouter()
  const editing = !!gasto

  const [centro,        setCentro]        = useState(gasto?.centro_costo   ?? 'proyecto')
  const [proyectoId,    setProyectoId]    = useState(gasto?.proyecto_id    ?? '')
  const [categoria,     setCategoria]     = useState(gasto?.categoria      ?? 'material')
  const [descripcion,   setDescripcion]   = useState(gasto?.descripcion    ?? '')
  const [referencia,    setReferencia]    = useState(gasto?.referencia     ?? '')
  const [medioPago,     setMedioPago]     = useState(gasto?.medio_pago    ?? 'efectivo')
  const [monto,         setMonto]         = useState(gasto?.monto.toString() ?? '')
  const [fecha,         setFecha]         = useState(gasto?.fecha          ?? new Date().toISOString().split('T')[0])
  const [comprobante,   setComprobante]   = useState(gasto?.comprobante    ?? '')
  const [registradoPor, setRegistradoPor] = useState(gasto?.registrado_por ?? '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const requiereProyecto = centro === 'proyecto'

  function handleCentro(val: string) {
    setCentro(val)
    if (val === 'proyecto') {
      setProyectoId('')
    } else {
      const codigo = CENTRO_CODIGO[val]
      const interno = proyectos.find(p => p.codigo === codigo)
      setProyectoId(interno?.id ?? '')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descripcion)                    { setError('La descripción es requerida'); return }
    if (!monto)                          { setError('El monto es requerido'); return }
    if (requiereProyecto && !proyectoId) { setError('Selecciona un proyecto'); return }

    setSaving(true)
    setError('')

    const supabase = createClient()
    const payload  = {
      empresa_id:     empresaId,
      centro_costo:   centro,
      proyecto_id:    requiereProyecto ? proyectoId : (proyectoId || null),
      categoria,
      descripcion,
      referencia:     referencia || null,
      medio_pago:     medioPago,
      monto:          parseFloat(monto),
      fecha,
      comprobante:    comprobante    || null,
      registrado_por: registradoPor  || null,
    }

    const { error: dbErr } = editing
      ? await supabase.from('costo_directo').update(payload).eq('id', gasto!.id)
      : await supabase.from('costo_directo').insert(payload)

    if (dbErr) { setError(dbErr.message); setSaving(false); return }

    router.refresh()
    onClose()
  }

  const centroInfo = CENTROS.find(c => c.val === centro)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,.25)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{editing ? 'Editar gasto' : 'Registrar gasto'}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Caja chica · cuenta corriente · cualquier egreso</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', padding: 4 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Centro de costo */}
          <div>
            <Label>Centro de costo *</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CENTROS.map(c => (
                <button key={c.val} type="button" onClick={() => handleCentro(c.val)}
                  style={{
                    padding: '8px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${centro === c.val ? '#2563EB' : '#E2E8F0'}`,
                    background: centro === c.val ? '#EFF6FF' : '#F8FAFC',
                    color: centro === c.val ? '#1D4ED8' : '#374151',
                    transition: 'all .15s',
                  }}>
                  <div>{c.icon} {c.label}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 400, color: centro === c.val ? '#3B82F6' : '#94A3B8', marginTop: 2 }}>{c.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Proyecto */}
          <div>
            <Label>
              {requiereProyecto
                ? <>Proyecto <span style={{ color: '#EF4444' }}>*</span></>
                : <>Proyecto interno <span style={{ fontWeight: 400, color: '#94A3B8' }}>(auto-asignado)</span></>}
            </Label>
            {requiereProyecto ? (
              <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
                style={inputStyle(!proyectoId ? { border: '1.5px solid #F59E0B' } : {})}>
                <option value="">— Selecciona un proyecto —</option>
                {proyectos.filter(p => !Object.values(CENTRO_CODIGO).includes(p.codigo ?? '')).map(p =>
                  <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
                )}
              </select>
            ) : (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F1F5F9', border: '1.5px solid #E2E8F0', fontSize: 13, color: '#374151' }}>
                {proyectos.find(p => p.id === proyectoId)?.nombre ?? (
                  <span style={{ color: '#F59E0B' }}>⚠ Proyecto interno no encontrado — ejecuta el SQL de configuración</span>
                )}
              </div>
            )}
          </div>

          {/* Categoría */}
          <div>
            <Label>Categoría *</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIAS.map(c => (
                <button key={c.val} type="button" onClick={() => setCategoria(c.val)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${categoria === c.val ? '#2563EB' : '#E2E8F0'}`,
                  background: categoria === c.val ? '#EFF6FF' : '#fff',
                  color: categoria === c.val ? '#2563EB' : '#64748B',
                  transition: 'all .15s',
                }}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <Label>Descripción *</Label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Combustible semana, planilla semanal, útiles de oficina…"
              style={inputStyle()} />
          </div>

          {/* Referencia — recurso específico */}
          <div>
            <Label>
              Referencia / Recurso
              <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>— especifica el equipo, vehículo o ítem</span>
            </Label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder={REF_PLACEHOLDER[centro] ?? 'Detalle adicional opcional'}
              style={inputStyle()} />
          </div>

          {/* Medio de pago */}
          <div>
            <Label>Medio de pago *</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {MEDIOS_PAGO.map(m => (
                <button key={m.val} type="button" onClick={() => setMedioPago(m.val)} style={{
                  flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                  border: `1.5px solid ${medioPago === m.val ? '#0F172A' : '#E2E8F0'}`,
                  background: medioPago === m.val ? '#0F172A' : '#F8FAFC',
                  color: medioPago === m.val ? '#fff' : '#64748B',
                  transition: 'all .15s',
                }}>
                  <div>{m.label}</div>
                  <div style={{ fontSize: 9, fontWeight: 400, marginTop: 1, opacity: .7 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Monto + Comprobante */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Monto (S/) *</Label>
              <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" style={inputStyle()} />
            </div>
            <div>
              <Label>N° Comprobante / Boleta</Label>
              <input value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="B001-00042" style={inputStyle()} />
            </div>
          </div>

          {/* Fecha + Registrado por */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Fecha *</Label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <Label>Registrado por</Label>
              <input value={registradoPor} onChange={e => setRegistradoPor(e.target.value)} placeholder="Nombre de quien registra" style={inputStyle()} />
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, fontSize: 11.5, color: '#DC2626' }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saving ? '#94A3B8' : '#0F172A', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
