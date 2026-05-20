import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, TrendingUp, Edit2, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useRole } from '../context/RoleContext'

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC']

const CATEGORIAS = [
  { key: 'facturacion',     label: 'Facturación',      color: '#10B981' },
  { key: 'coste_personal',  label: 'Coste Personal',   color: '#7C4DFF' },
  { key: 'gastos_personal', label: 'Gastos Personal',  color: '#6366F1' },
  { key: 'produccion',      label: 'Producción',       color: '#F59E0B' },
  { key: 'plan_medios',     label: 'Plan de Medios',   color: '#EF4444' },
]

const ESTADO_OPTS = [
  { value: 'activo',    label: 'Activo' },
  { value: 'preparado', label: 'Preparado' },
  { value: 'cerrado',   label: 'Cerrado' },
]

function fmt(n) {
  if (n == null || isNaN(n) || n === 0) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(num, den) {
  if (!den || den === 0) return '—'
  const v = (num / den) * 100
  return v.toFixed(1) + '%'
}

export default function EcoFinProyecto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { isManager } = useRole()

  const [proyecto, setProyecto] = useState(null)
  const [grid, setGrid] = useState({})  // { 'facturacion-1': 0, ... }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerForm, setHeaderForm] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data: pData } = await supabase.from('eco_proyectos').select('*').eq('id', id).single()
    if (!pData) { navigate('/ecofin'); return }
    setProyecto(pData)
    setAnio(pData.anio)
    setHeaderForm({
      nombre_contrato: pData.nombre_contrato,
      cliente: pData.cliente,
      codigo_proyecto: pData.codigo_proyecto,
      codigo_contrato: pData.codigo_contrato || '',
      presupuesto_base: pData.presupuesto_base,
      ampliaciones: pData.ampliaciones || 0,
      estado: pData.estado,
    })

    const { data: eData } = await supabase
      .from('eco_entradas').select('*').eq('proyecto_id', id).eq('anio', pData.anio)

    const g = {}
    CATEGORIAS.forEach(c => {
      MESES.forEach((_, i) => { g[`${c.key}-${i + 1}`] = 0 })
    })
    ;(eData || []).forEach(e => { g[`${e.categoria}-${e.mes}`] = Number(e.importe) })
    setGrid(g)
    setDirty(false)
    setLoading(false)
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  function cellKey(cat, mes) { return `${cat}-${mes}` }

  function handleCell(cat, mes, raw) {
    const val = parseFloat(raw.replace(',', '.')) || 0
    setGrid(g => ({ ...g, [cellKey(cat, mes)]: val }))
    setDirty(true)
  }

  async function save() {
    if (!dirty) return
    setSaving(true)
    const upserts = []
    CATEGORIAS.forEach(c => {
      MESES.forEach((_, i) => {
        const mes = i + 1
        const importe = grid[cellKey(c.key, mes)] || 0
        upserts.push({ proyecto_id: id, anio, mes, categoria: c.key, importe })
      })
    })
    await supabase.from('eco_entradas').upsert(upserts, { onConflict: 'proyecto_id,anio,mes,categoria' })
    setSaving(false)
    setDirty(false)
  }

  async function saveHeader() {
    await supabase.from('eco_proyectos').update({
      nombre_contrato: headerForm.nombre_contrato,
      cliente: headerForm.cliente,
      codigo_proyecto: headerForm.codigo_proyecto,
      codigo_contrato: headerForm.codigo_contrato || null,
      presupuesto_base: Number(headerForm.presupuesto_base) || 0,
      ampliaciones: Number(headerForm.ampliaciones) || 0,
      estado: headerForm.estado,
    }).eq('id', id)
    setProyecto(p => ({ ...p, ...headerForm }))
    setEditingHeader(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const presupuesto = Number(proyecto.presupuesto_base) + Number(proyecto.ampliaciones || 0)
  const rowTotal    = cat => MESES.reduce((a, _, i) => a + (grid[cellKey(cat, i + 1)] || 0), 0)
  const facturacion     = rowTotal('facturacion')
  const coste_personal  = rowTotal('coste_personal')
  const gastos_personal = rowTotal('gastos_personal')
  const produccion      = rowTotal('produccion')
  const plan_medios     = rowTotal('plan_medios')
  const beneficio       = facturacion - coste_personal - gastos_personal - produccion - plan_medios
  const colTotal        = mes => CATEGORIAS.reduce((a, c) => a + (grid[cellKey(c.key, mes)] || 0), 0)

  const kpiCards = [
    { label: 'Presupuesto',   value: fmt(presupuesto),   color: '#7C4DFF' },
    { label: 'Facturación',   value: fmt(facturacion),   sub: fmtPct(facturacion, presupuesto) + ' ejecutado', color: '#10B981' },
    { label: 'Coste Personal',value: fmt(coste_personal),sub: fmtPct(coste_personal, facturacion) + ' s/factura', color: '#6366F1' },
    { label: 'Producción',    value: fmt(produccion),    sub: fmtPct(produccion, facturacion) + ' s/factura', color: '#F59E0B' },
    { label: 'Plan Medios',   value: fmt(plan_medios),   sub: fmtPct(plan_medios, facturacion) + ' s/factura', color: '#EF4444' },
    { label: 'Beneficio',     value: fmt(beneficio),     sub: fmtPct(beneficio, facturacion) + ' ganancia', color: beneficio >= 0 ? '#10B981' : '#EF4444' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button
            onClick={() => navigate('/ecofin')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, padding: 0, marginBottom: 10 }}
          >
            <ArrowLeft size={14} /> Volver al dashboard
          </button>
          {!editingHeader ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11,
                background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={20} color="white" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0, letterSpacing: '-0.3px' }}>
                    {proyecto.nombre_contrato}
                  </h1>
                  {isManager && (
                    <button onClick={() => setEditingHeader(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', padding: 0 }}>
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--c-text-3)', margin: 0 }}>
                  <span style={{ fontWeight: 600, color: '#F59E0B', fontFamily: 'Space Grotesk, sans-serif' }}>{proyecto.codigo_proyecto}</span>
                  {proyecto.codigo_contrato && <span> · {proyecto.codigo_contrato}</span>}
                  <span> · {proyecto.cliente}</span>
                  <span> · {proyecto.anio}</span>
                </p>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 20, minWidth: 520 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', marginBottom: 14, marginTop: 0 }}>Editar proyecto</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Nombre contrato', 'nombre_contrato'],
                  ['Cliente', 'cliente'],
                  ['Código proyecto', 'codigo_proyecto'],
                  ['Código contrato', 'codigo_contrato'],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      value={headerForm[key]}
                      onChange={e => setHeaderForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>Presupuesto base (€)</label>
                  <input type="number" value={headerForm.presupuesto_base} onChange={e => setHeaderForm(f => ({ ...f, presupuesto_base: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>Ampliaciones (€)</label>
                  <input type="number" value={headerForm.ampliaciones} onChange={e => setHeaderForm(f => ({ ...f, ampliaciones: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>Estado</label>
                  <select value={headerForm.estado} onChange={e => setHeaderForm(f => ({ ...f, estado: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box' }}>
                    {ESTADO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={saveHeader} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Check size={13} /> Guardar
                </button>
                <button onClick={() => setEditingHeader(false)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: 13 }}>
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        {isManager && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: dirty ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'var(--c-bg-muted)',
              color: dirty ? '#fff' : 'var(--c-text-3)',
              border: 'none', cursor: dirty ? 'pointer' : 'default',
              boxShadow: dirty ? '0 2px 8px rgba(245,158,11,0.35)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Save size={15} /> {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 24 }}>
        {kpiCards.map(c => (
          <div key={c.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-3)', margin: '0 0 5px' }}>{c.label}</p>
            <p className="font-numeric" style={{ fontSize: 18, fontWeight: 700, color: c.color, margin: '0 0 3px', letterSpacing: '-0.4px' }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 11, color: 'var(--c-text-3)', margin: 0 }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Monthly grid */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)' }}>Datos mensuales · {anio}</p>
          {dirty && <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>Cambios sin guardar</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--c-bg-muted)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)', minWidth: 140 }}>Categoría</th>
                {MESES.map(m => (
                  <th key={m} style={{ padding: '9px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)', minWidth: 80 }}>{m}</th>
                ))}
                <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)', minWidth: 100 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIAS.map((cat, ci) => (
                <tr key={cat.key} style={{ borderBottom: '1px solid var(--c-border-light)', background: ci % 2 === 0 ? 'transparent' : 'var(--c-bg-muted)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--c-text-1)' }}>{cat.label}</span>
                    </div>
                  </td>
                  {MESES.map((_, mi) => {
                    const mes = mi + 1
                    const val = grid[cellKey(cat.key, mes)] || 0
                    return (
                      <td key={mes} style={{ padding: '6px 4px', textAlign: 'center' }}>
                        {isManager ? (
                          <CellInput
                            value={val}
                            onChange={v => handleCell(cat.key, mes, v)}
                            color={cat.color}
                          />
                        ) : (
                          <span className="font-numeric" style={{ fontSize: 12, color: val > 0 ? 'var(--c-text-1)' : 'var(--c-text-4)' }}>
                            {val > 0 ? val.toLocaleString('es-ES') : '—'}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="font-numeric" style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: cat.color, borderLeft: '1px solid var(--c-border)' }}>
                    {rowTotal(cat.key) > 0 ? rowTotal(cat.key).toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--c-bg-muted)', borderTop: '2px solid var(--c-border)' }}>
                <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Beneficio</td>
                {MESES.map((_, mi) => {
                  const mes = mi + 1
                  const fact = grid[cellKey('facturacion', mes)] || 0
                  const cp   = grid[cellKey('coste_personal', mes)] || 0
                  const gp   = grid[cellKey('gastos_personal', mes)] || 0
                  const prod = grid[cellKey('produccion', mes)] || 0
                  const pm   = grid[cellKey('plan_medios', mes)] || 0
                  const ben  = fact - cp - gp - prod - pm
                  return (
                    <td key={mes} className="font-numeric" style={{ padding: '11px 4px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: ben > 0 ? '#10B981' : ben < 0 ? '#EF4444' : 'var(--c-text-4)' }}>
                      {ben !== 0 ? ben.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                  )
                })}
                <td className="font-numeric" style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: beneficio >= 0 ? '#10B981' : '#EF4444', borderLeft: '1px solid var(--c-border)' }}>
                  {beneficio.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function CellInput({ value, onChange, color }) {
  const [focused, setFocused] = useState(false)
  const [localVal, setLocalVal] = useState(value === 0 ? '' : String(value))

  useEffect(() => {
    if (!focused) setLocalVal(value === 0 ? '' : String(value))
  }, [value, focused])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? localVal : (value === 0 ? '' : value.toLocaleString('es-ES', { maximumFractionDigits: 0 }))}
      placeholder="—"
      onFocus={() => { setFocused(true); setLocalVal(value === 0 ? '' : String(value)) }}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={() => { setFocused(false); onChange(localVal || '0') }}
      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
      style={{
        width: 72, padding: '5px 6px', textAlign: 'right', fontSize: 12,
        border: focused ? `1.5px solid ${color}` : '1.5px solid transparent',
        borderRadius: 6, background: focused ? `${color}10` : 'transparent',
        color: value > 0 ? 'var(--c-text-1)' : 'var(--c-text-4)',
        fontFamily: 'Space Grotesk, sans-serif', outline: 'none',
        transition: 'all 0.15s', cursor: 'text',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => { if (!focused) e.target.style.border = `1.5px solid ${color}40` }}
      onMouseLeave={e => { if (!focused) e.target.style.border = '1.5px solid transparent' }}
    />
  )
}
