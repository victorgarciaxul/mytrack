import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'

const ESTADO_OPTS = [
  { value: 'activo',    label: 'Activo' },
  { value: 'preparado', label: 'Preparado' },
  { value: 'cerrado',   label: 'Cerrado' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function EcoFinNuevo() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    codigo_proyecto: '',
    codigo_contrato: '',
    nombre_contrato: '',
    cliente: '',
    anio: CURRENT_YEAR,
    presupuesto_base: '',
    ampliaciones: '',
    estado: 'activo',
  })

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: null }))
  }

  function validate() {
    const e = {}
    if (!form.codigo_proyecto.trim()) e.codigo_proyecto = 'Obligatorio'
    if (!form.nombre_contrato.trim()) e.nombre_contrato = 'Obligatorio'
    if (!form.cliente.trim()) e.cliente = 'Obligatorio'
    if (form.presupuesto_base !== '' && isNaN(Number(form.presupuesto_base))) e.presupuesto_base = 'Debe ser un número'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const { data, error } = await supabase.from('eco_proyectos').insert({
      workspace_id: workspace.id,
      codigo_proyecto: form.codigo_proyecto.trim(),
      codigo_contrato: form.codigo_contrato.trim() || null,
      nombre_contrato: form.nombre_contrato.trim(),
      cliente: form.cliente.trim(),
      anio: Number(form.anio),
      presupuesto_base: Number(form.presupuesto_base) || 0,
      ampliaciones: Number(form.ampliaciones) || 0,
      estado: form.estado,
    }).select().single()
    setSaving(false)
    if (!error && data) navigate(`/ecofin/${data.id}`)
  }

  const Field = ({ label, name, type = 'text', required, placeholder }) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={e => set(name, e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
          border: `1.5px solid ${errors[name] ? '#EF4444' : 'var(--c-border)'}`,
          background: 'var(--c-input-bg)', color: 'var(--c-text-1)', outline: 'none',
          boxSizing: 'border-box', transition: 'border-color 0.15s',
          fontFamily: type === 'number' ? 'Space Grotesk, sans-serif' : 'inherit',
        }}
        onFocus={e => { if (!errors[name]) e.target.style.borderColor = '#F59E0B' }}
        onBlur={e => { if (!errors[name]) e.target.style.borderColor = 'var(--c-border)' }}
      />
      {errors[name] && <p style={{ fontSize: 11, color: '#EF4444', margin: '4px 0 0' }}>{errors[name]}</p>}
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <button
        onClick={() => navigate('/ecofin')}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, padding: 0, marginBottom: 20 }}
      >
        <ArrowLeft size={14} /> Volver al dashboard
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
        }}>
          <TrendingUp size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0, letterSpacing: '-0.3px' }}>Nuevo proyecto</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', margin: 0 }}>Rellena los datos del contrato para empezar el seguimiento</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', margin: 0 }}>Identificación</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Código proyecto" name="codigo_proyecto" required placeholder="2026-020" />
            <Field label="Código contrato" name="codigo_contrato" placeholder="XUL-CONTR-020" />
          </div>

          <Field label="Nombre del contrato" name="nombre_contrato" required placeholder="Nombre del proyecto o licitación" />
          <Field label="Cliente / Entidad" name="cliente" required placeholder="Junta de Andalucía, SANDETEL…" />

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', margin: '0 0 16px' }}>Presupuesto</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>Año</label>
                <select value={form.anio} onChange={e => set('anio', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <Field label="Presupuesto base (€)" name="presupuesto_base" type="number" placeholder="0" />
              <Field label="Ampliaciones (€)" name="ampliaciones" type="number" placeholder="0" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', margin: '0 0 16px' }}>Estado</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {ESTADO_OPTS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('estado', o.value)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${form.estado === o.value ? '#F59E0B' : 'var(--c-border)'}`,
                    background: form.estado === o.value ? '#F59E0B18' : 'var(--c-bg-muted)',
                    color: form.estado === o.value ? '#F59E0B' : 'var(--c-text-2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => navigate('/ecofin')}
            style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff',
              border: 'none', cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 2px 10px rgba(245,158,11,0.35)',
            }}>
            <Check size={15} /> {saving ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
