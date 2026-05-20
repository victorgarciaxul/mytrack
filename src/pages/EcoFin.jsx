import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Plus, Search, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'

const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEPT','OCT','NOV','DIC']

const ESTADO_BADGE = {
  activo:    { label: 'Activo',    bg: '#10B98120', color: '#10B981' },
  preparado: { label: 'Preparado', bg: '#F59E0B20', color: '#F59E0B' },
  cerrado:   { label: 'Cerrado',   bg: '#6B728020', color: '#6B7280' },
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function pct(num, den) {
  if (!den || den === 0) return null
  return num / den
}

function PctBadge({ value }) {
  if (value == null) return <span style={{ color: 'var(--c-text-4)', fontSize: 11 }}>—</span>
  const pct = (value * 100).toFixed(1) + '%'
  const color = value < 0 ? '#EF4444' : value > 0.2 ? '#10B981' : '#F59E0B'
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}</span>
}

export default function EcoFin() {
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState([])
  const [entradas, setEntradas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [sort, setSort] = useState({ col: 'codigo_proyecto', dir: 'asc' })

  const load = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data: proyData } = await supabase
      .from('eco_proyectos')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('anio', anio)
      .order('codigo_proyecto')

    if (!proyData || proyData.length === 0) {
      setProyectos([])
      setEntradas([])
      setLoading(false)
      return
    }

    const ids = proyData.map(p => p.id)
    const { data: entData } = await supabase
      .from('eco_entradas')
      .select('*')
      .in('proyecto_id', ids)
      .eq('anio', anio)

    setProyectos(proyData)
    setEntradas(entData || [])
    setLoading(false)
  }, [workspace, anio])

  useEffect(() => { load() }, [load])

  function getKpis(proyId) {
    const e = entradas.filter(x => x.proyecto_id === proyId)
    const sum = cat => e.filter(x => x.categoria === cat).reduce((a, b) => a + Number(b.importe), 0)
    const facturacion     = sum('facturacion')
    const coste_personal  = sum('coste_personal')
    const gastos_personal = sum('gastos_personal')
    const produccion      = sum('produccion')
    const plan_medios     = sum('plan_medios')
    const beneficio       = facturacion - coste_personal - gastos_personal - produccion - plan_medios
    return { facturacion, coste_personal, gastos_personal, produccion, plan_medios, beneficio }
  }

  const rows = proyectos
    .filter(p =>
      p.nombre_contrato.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_proyecto.toLowerCase().includes(search.toLowerCase())
    )
    .map(p => {
      const presupuesto = Number(p.presupuesto_base) + Number(p.ampliaciones || 0)
      const kpis = getKpis(p.id)
      return { ...p, presupuesto, ...kpis }
    })
    .sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col]
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va || 0) - (vb || 0)
      return sort.dir === 'asc' ? cmp : -cmp
    })

  // Totales
  const totales = rows.reduce((acc, r) => {
    acc.presupuesto    += r.presupuesto
    acc.facturacion    += r.facturacion
    acc.coste_personal += r.coste_personal
    acc.gastos_personal+= r.gastos_personal
    acc.produccion     += r.produccion
    acc.plan_medios    += r.plan_medios
    acc.beneficio      += r.beneficio
    return acc
  }, { presupuesto: 0, facturacion: 0, coste_personal: 0, gastos_personal: 0, produccion: 0, plan_medios: 0, beneficio: 0 })

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronUp size={11} style={{ opacity: 0.3 }} />
    return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  const th = (label, col, align = 'right') => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--c-text-3)', whiteSpace: 'nowrap',
        textAlign: align, cursor: 'pointer', userSelect: 'none',
        borderBottom: '1px solid var(--c-border)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label} <SortIcon col={col} />
      </span>
    </th>
  )

  const summaryCards = [
    { label: 'Presupuesto total', value: fmt(totales.presupuesto), color: '#7C4DFF' },
    { label: 'Facturación', value: fmt(totales.facturacion), sub: pct(totales.facturacion, totales.presupuesto), color: '#10B981' },
    { label: 'Coste personal', value: fmt(totales.coste_personal), sub: pct(totales.coste_personal, totales.facturacion), color: '#F59E0B' },
    { label: 'Beneficio', value: fmt(totales.beneficio), sub: pct(totales.beneficio, totales.facturacion), color: totales.beneficio >= 0 ? '#10B981' : '#EF4444' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
          }}>
            <TrendingUp size={20} color="white" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', margin: 0, letterSpacing: '-0.4px' }}>
              Control EcoFin
            </h1>
            <p style={{ fontSize: 13, color: 'var(--c-text-3)', margin: 0 }}>
              {rows.length} proyecto{rows.length !== 1 ? 's' : ''} · {anio}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Selector año */}
          <select
            value={anio}
            onChange={e => setAnio(Number(e.target.value))}
            style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: '1px solid var(--c-border)', background: 'var(--c-bg-surface)',
              color: 'var(--c-text-1)', cursor: 'pointer',
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => navigate('/ecofin/nuevo')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(245,158,11,0.35)',
            }}
          >
            <Plus size={15} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {summaryCards.map(c => (
          <div key={c.label} style={{
            background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-3)', margin: '0 0 6px' }}>{c.label}</p>
            <p className="font-numeric" style={{ fontSize: 22, fontWeight: 700, color: c.color, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{c.value}</p>
            {c.sub != null && <PctBadge value={c.sub} />}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar proyecto o cliente…"
          style={{
            width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--c-border)', background: 'var(--c-bg-surface)',
            color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--c-text-3)' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 14, fontWeight: 500 }}>No hay proyectos para {anio}</p>
            <button onClick={() => navigate('/ecofin/nuevo')} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Crear primer proyecto
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--c-bg-muted)' }}>
                  {th('ID', 'codigo_proyecto', 'left')}
                  {th('Contrato', 'nombre_contrato', 'left')}
                  {th('Cliente', 'cliente', 'left')}
                  <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', borderBottom: '1px solid var(--c-border)', textAlign: 'center' }}>Estado</th>
                  {th('Presupuesto', 'presupuesto')}
                  {th('Facturación', 'facturacion')}
                  {th('% Ejec.', null)}
                  {th('Coste Personal', 'coste_personal')}
                  {th('% CP', null)}
                  {th('Producción', 'produccion')}
                  {th('Plan Medios', 'plan_medios')}
                  {th('Beneficio', 'beneficio')}
                  {th('% Ganancia', null)}
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const ejecutado = pct(p.facturacion, p.presupuesto)
                  const pctCP     = pct(p.coste_personal, p.facturacion)
                  const pctGan    = pct(p.beneficio, p.facturacion)
                  const badge     = ESTADO_BADGE[p.estado] || ESTADO_BADGE.activo
                  const isNeg     = p.beneficio < 0

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/ecofin/${p.id}`)}
                      style={{
                        borderBottom: '1px solid var(--c-border-light)',
                        cursor: 'pointer',
                        background: i % 2 === 0 ? 'transparent' : 'var(--c-bg-muted)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#7C4DFF08'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--c-bg-muted)'}
                    >
                      <td style={{ padding: '11px 12px', fontWeight: 600, color: '#F59E0B', whiteSpace: 'nowrap', fontFamily: 'Space Grotesk, sans-serif' }}>{p.codigo_proyecto}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-1)', fontWeight: 500, maxWidth: 220 }}>
                        <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.nombre_contrato}</span>
                      </td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap' }}>{p.cliente}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-1)', fontWeight: 500 }}>{fmt(p.presupuesto)}</td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-1)', fontWeight: 500 }}>{fmt(p.facturacion)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <EjecutadoBar value={ejecutado} />
                      </td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.coste_personal)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctBadge value={pctCP} /></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.produccion)}</td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.plan_medios)}</td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: isNeg ? '#EF4444' : '#10B981' }}>{fmt(p.beneficio)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctBadge value={pctGan} /></td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totales */}
              <tfoot>
                <tr style={{ background: 'var(--c-bg-muted)', borderTop: '2px solid var(--c-border)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '12px 12px', fontSize: 12, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTALES</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', color: '#7C4DFF' }}>{fmt(totales.presupuesto)}</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', color: '#10B981' }}>{fmt(totales.facturacion)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctBadge value={pct(totales.facturacion, totales.presupuesto)} /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right' }}>{fmt(totales.coste_personal)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctBadge value={pct(totales.coste_personal, totales.facturacion)} /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right' }}>{fmt(totales.produccion)}</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right' }}>{fmt(totales.plan_medios)}</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', color: totales.beneficio >= 0 ? '#10B981' : '#EF4444' }}>{fmt(totales.beneficio)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctBadge value={pct(totales.beneficio, totales.facturacion)} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function EjecutadoBar({ value }) {
  if (value == null) return <span style={{ color: 'var(--c-text-4)', fontSize: 11 }}>—</span>
  const pct = Math.min(1, Math.max(0, value))
  const color = pct < 0.3 ? '#F59E0B' : pct < 0.8 ? '#7C4DFF' : '#10B981'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--c-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span className="font-numeric" style={{ fontSize: 11, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  )
}
