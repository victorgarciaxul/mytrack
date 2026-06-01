import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRole } from '../../context/RoleContext'
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react'

const TOUR_KEY = 'mytrack_tour_done'

// ─── Step definitions ────────────────────────────────────────────────────────
// Steps follow sidebar top-to-bottom order. Each role only sees sections
// that are actually visible to them in the sidebar.

// ── Employee (sees: Tracker, Calendar, Overtime, Notifications + project nav) ──
const EMPLOYEE_STEPS = [
  {
    target: null,
    title: '👋 Bienvenido a MyTrack',
    content: 'Tu herramienta de registro de tiempo en XUL. En dos minutos dominarás todo. ¿Dudas? Escríbenos a tech@xul.es.',
  },
  {
    target: '[data-tour="app-launcher"]',
    title: '⬡ Apps XUL',
    content: 'Desde este menú accedes a todas las herramientas de XUL: DeepTalk, CRM, EcoFin, Briefing y más, sin salir de la app.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-tracker"]',
    title: '⏱ Registro de tiempo',
    content: 'Tu página principal. Arranca el timer en vivo o añade entradas manualmente si lo recuerdas después.',
    route: '/tracker',
  },
  {
    target: '[data-tour="timer-bar"]',
    title: 'Timer en vivo',
    content: 'Describe en qué trabajas, elige proyecto y pulsa ▶. Al parar, la entrada se guarda automáticamente.',
    route: '/tracker',
  },
  {
    target: '[data-tour="project-picker"]',
    title: '📁 Elige siempre un proyecto',
    content: 'Asigna cada bloque a un proyecto. Es clave para que los informes del equipo sean precisos.',
    route: '/tracker',
  },
  {
    target: '[data-tour="manual-btn"]',
    title: '✏️ Entrada manual',
    content: '¿Olvidaste el timer? Añade el bloque después indicando hora de inicio y fin.',
    route: '/tracker',
  },
  {
    target: '[data-tour="entries-list"]',
    title: '📋 Tu historial',
    content: 'Tus entradas agrupadas por día. Pasa el cursor sobre una para editarla o eliminarla.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-calendar"]',
    title: '📅 Calendario',
    content: 'Vista mensual de todo tu tiempo registrado. Toca cualquier día para ver el detalle y editar entradas.',
    route: '/calendar',
  },
  {
    target: '[data-tour="nav-overtime"]',
    title: '⏰ Compensación',
    content: 'Consulta tus horas extra acumuladas y los ajustes que haya aplicado tu gestor.',
    route: '/overtime',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: '🔔 Bandeja de entrada',
    content: 'Avisos cuando no hayas imputado tiempo. El punto rojo indica mensajes sin leer.',
    route: '/overtime',
  },
  {
    target: null,
    title: '✅ ¡Todo listo!',
    content: 'Empieza registrando tu primer bloque de hoy. Cualquier duda: tech@xul.es.',
  },
]

// ── Manager (adds: Reports, Team, Projects, Clients, Tags, Time-off, Settings) ──
const MANAGER_STEPS = [
  {
    target: null,
    title: '👋 Bienvenido a MyTrack',
    content: 'Panel de gestión del equipo XUL. El tutorial dura ~2 minutos. Soporte técnico: tech@xul.es.',
  },
  {
    target: '[data-tour="app-launcher"]',
    title: '⬡ Apps XUL',
    content: 'Acceso rápido a todas las herramientas de XUL: DeepTalk, CRM, EcoFin, Briefing y más desde un solo menú.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-tracker"]',
    title: '⏱ Registro de tiempo',
    content: 'Tú también imputas tiempo. Elige siempre proyecto y tarea para que los informes sean precisos.',
    route: '/tracker',
  },
  {
    target: '[data-tour="timer-bar"]',
    title: 'Proyecto → Tarea',
    content: 'Selecciona el proyecto primero y aparecerá el selector de tarea. Cada entrada queda correctamente etiquetada.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-calendar"]',
    title: '📅 Calendario',
    content: 'Tu historial completo en vista mensual. Los datos vienen directamente de la base de datos, siempre actualizados.',
    route: '/calendar',
  },
  {
    target: '[data-tour="nav-reports"]',
    title: '📈 Informes',
    content: 'Filtra por semana o mes, por proyecto, cliente o persona. Base para facturación y seguimiento del equipo.',
    route: '/reports',
  },
  {
    target: '[data-tour="nav-overtime"]',
    title: '⏰ Compensación de horas',
    content: 'Gestiona las horas extra: quién acumula saldo positivo o negativo y aplica compensaciones al equipo.',
    route: '/overtime',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: '🔔 Alertas',
    content: 'Notificaciones del sistema: miembros sin imputar, proyectos al límite de presupuesto y resúmenes semanales.',
    route: '/notifications',
  },
  {
    target: '[data-tour="nav-projects"]',
    title: '📁 Proyectos',
    content: 'Crea proyectos con presupuesto de horas y define las tareas que el equipo puede seleccionar al imputar.',
    route: '/projects',
  },
  {
    target: '[data-tour="nav-team"]',
    title: '👥 Equipo',
    content: 'Todos los miembros, sus roles, grupos y tarifas por hora. Ajusta los costes que aparecen en los informes.',
    route: '/team',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Ajustes',
    content: 'Configura el workspace, importa datos desde Clockify y resetea este tutorial cuando quieras.',
    route: '/settings',
  },
  {
    target: null,
    title: '✅ ¡Todo listo!',
    content: '¡Ya dominas MyTrack como gestor! Empieza creando proyectos y asegúrate de que el equipo los tenga asignados.',
  },
]

// ── Admin (manager + workspace switcher + costs, en orden del sidebar) ──────
const ADMIN_STEPS = [
  {
    target: null,
    title: '👋 Bienvenido a MyTrack',
    content: 'Panel de administración de XUL. El tutorial dura ~2 minutos. Soporte técnico: tech@xul.es.',
  },
  {
    target: '[data-tour="app-launcher"]',
    title: '⬡ Apps XUL',
    content: 'Acceso rápido a todas las herramientas de XUL: DeepTalk, CRM, EcoFin, Briefing y más desde un solo menú.',
    route: '/tracker',
  },
  {
    target: '[data-tour="workspace-switcher"]',
    title: '🔀 Espacios de trabajo',
    content: 'Alterna entre XUL y Fundación. Cada espacio tiene sus usuarios, proyectos e informes completamente aislados. Solo los admins ven este selector.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-tracker"]',
    title: '⏱ Registro de tiempo',
    content: 'Tú también imputas tiempo, siempre en tu espacio XUL. Elige proyecto y tarea para que los informes sean precisos.',
    route: '/tracker',
  },
  {
    target: '[data-tour="timer-bar"]',
    title: 'Proyecto → Tarea',
    content: 'Selecciona el proyecto primero y aparecerá el selector de tarea. Cada entrada queda correctamente etiquetada.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-calendar"]',
    title: '📅 Calendario',
    content: 'Tu historial completo en vista mensual, cargado directamente desde la base de datos.',
    route: '/calendar',
  },
  {
    target: '[data-tour="nav-reports"]',
    title: '📈 Informes',
    content: 'Filtra por período, proyecto, cliente o persona. En el espacio Fundación solo muestra a Ana y Cristina.',
    route: '/reports',
  },
  {
    target: '[data-tour="nav-overtime"]',
    title: '⏰ Compensación de horas',
    content: 'Gestiona las horas extra del equipo: saldo acumulado y ajustes de compensación.',
    route: '/overtime',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: '🔔 Alertas',
    content: 'Notificaciones del sistema: miembros sin imputar, proyectos al límite y resúmenes semanales.',
    route: '/notifications',
  },
  {
    target: '[data-tour="nav-projects"]',
    title: '📁 Proyectos',
    content: 'Crea proyectos con presupuesto de horas y define las tareas disponibles para el equipo.',
    route: '/projects',
  },
  {
    target: '[data-tour="nav-team"]',
    title: '👥 Equipo',
    content: 'Todos los miembros, roles y tarifas por hora. Ajusta los costes que aparecen en los informes.',
    route: '/team',
  },
  {
    target: '[data-tour="nav-costs"]',
    title: '💶 Costes del equipo',
    content: 'Coste real de cada proyecto y persona según tarifas. Filtra por mes, trimestre o todo el año.',
    route: '/costs',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Ajustes',
    content: 'Configura el workspace, importa datos desde Clockify y resetea este tutorial cuando quieras.',
    route: '/settings',
  },
  {
    target: null,
    title: '✅ ¡Todo listo!',
    content: '¡Ya dominas MyTrack como admin! Recuerda que puedes cambiar de espacio en cualquier momento desde el switcher del sidebar.',
  },
]

// ─── Utility: find element rect ──────────────────────────────────────────────

function getRect(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right }
}

// ─── Tooltip position logic ───────────────────────────────────────────────────

const TIP_W = 340
const TIP_H = 200

function tooltipStyle(rect) {
  if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  const pad = 18
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top, left, transform = ''

  if (rect.bottom + TIP_H + pad <= vh) {
    top = rect.bottom + pad; left = rect.left + rect.width / 2 - TIP_W / 2
  } else if (rect.top - TIP_H - pad >= 0) {
    top = rect.top - TIP_H - pad; left = rect.left + rect.width / 2 - TIP_W / 2
  } else if (rect.right + TIP_W + pad <= vw) {
    top = rect.top + rect.height / 2 - TIP_H / 2; left = rect.right + pad
  } else {
    top = rect.top + rect.height / 2 - TIP_H / 2; left = rect.left - TIP_W - pad
  }

  left = Math.max(12, Math.min(left, vw - TIP_W - 12))
  top  = Math.max(12, Math.min(top,  vh - 12))

  return { position: 'fixed', top, left, width: TIP_W, transform }
}

// ─── Overlay (SVG spotlight) ──────────────────────────────────────────────────

function Overlay({ rect, onSkip }) {
  const pad = 10
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9997, cursor: 'default' }}
      onClick={e => { if (e.target === e.currentTarget) onSkip() }}
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad} y={rect.top - pad}
                width={rect.width + pad * 2} height={rect.height + pad * 2}
                rx="10" fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(10,10,28,0.78)" mask="url(#tour-spotlight)" />
        {rect && (
          <rect
            x={rect.left - pad} y={rect.top - pad}
            width={rect.width + pad * 2} height={rect.height + pad * 2}
            rx="10" fill="none" stroke="#7B68EE" strokeWidth="1.5" opacity="0.7"
          />
        )}
      </svg>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ step, index, total, rect, onNext, onPrev, onSkip }) {
  const isFirst = index === 0
  const isLast  = index === total - 1

  return (
    <div
      style={{
        ...tooltipStyle(rect),
        zIndex: 9999,
        background: '#1A1A2E',
        border: '1px solid var(--c-border)',
        borderRadius: 16,
        padding: '22px 24px 18px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        fontFamily: 'inherit',
        pointerEvents: 'all',
      }}
    >
      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? '#7B68EE' : i < index ? '#4A4A7A' : '#2E2E4A',
              transition: 'all 0.3s',
              flexShrink: 0,
            }}
          />
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A5A7A' }}>{index + 1} / {total}</span>
      </div>

      {/* Content */}
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
        {step.title}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9090B8', lineHeight: 1.65 }}>
        {step.content}
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onSkip}
          style={{ marginRight: 'auto', fontSize: 12, color: '#5A5A7A', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Saltar tutorial
        </button>
        {!isFirst && (
          <button
            onClick={onPrev}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '7px 14px', borderRadius: 10, border: '1px solid var(--c-border)',
              background: 'transparent', color: '#8888A8', fontSize: 13, cursor: 'pointer',
            }}
          >
            <ChevronLeft size={14} />Atrás
          </button>
        )}
        <button
          onClick={onNext}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)',
            boxShadow: '0 4px 12px rgba(107,78,255,0.4)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {isLast ? (
            <><Play size={13} fill="white" style={{ marginRight: 2 }} />¡Listo!</>
          ) : (
            <>Siguiente<ChevronRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main AppTour component ───────────────────────────────────────────────────

export default function AppTour({ run, onFinish }) {
  const { isManager, isAdmin } = useRole()
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const navigatingRef = useRef(false)

  const steps = isAdmin ? ADMIN_STEPS : isManager ? MANAGER_STEPS : EMPLOYEE_STEPS

  const current = steps[stepIndex]

  // Measure target element after navigation / step change
  const measureTarget = useCallback(() => {
    if (!current) return
    const r = getRect(current.target)
    setRect(r)
  }, [current])

  useEffect(() => {
    if (!run || !current) return
    // Navigate to required route first if needed
    if (current.route && current.route !== location.pathname) {
      navigatingRef.current = true
      navigate(current.route)
      return
    }
    // Wait a tick for React to finish rendering the new page
    const t = setTimeout(measureTarget, 120)
    return () => clearTimeout(t)
  }, [run, stepIndex, location.pathname])

  // After navigation completes, measure
  useEffect(() => {
    if (!run || !navigatingRef.current) return
    navigatingRef.current = false
    const t = setTimeout(measureTarget, 200)
    return () => clearTimeout(t)
  }, [location.pathname])

  // Reset on re-open
  useEffect(() => {
    if (run) { setStepIndex(0); setRect(null) }
  }, [run])

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, 'true')
    setStepIndex(0)
    setRect(null)
    onFinish?.()
  }, [onFinish])

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) { finish(); return }
    setStepIndex(i => i + 1)
  }, [stepIndex, steps.length, finish])

  const goPrev = useCallback(() => {
    if (stepIndex <= 0) return
    setStepIndex(i => i - 1)
  }, [stepIndex])

  if (!run || !current) return null

  return createPortal(
    <>
      <Overlay rect={rect} onSkip={finish} />
      <Tooltip
        step={current}
        index={stepIndex}
        total={steps.length}
        rect={rect}
        onNext={goNext}
        onPrev={goPrev}
        onSkip={finish}
      />
    </>,
    document.body
  )
}

// ─── useTour hook ─────────────────────────────────────────────────────────────

export function useTour() {
  const isDone  = () => localStorage.getItem(TOUR_KEY) === 'true'
  const resetTour = () => localStorage.removeItem(TOUR_KEY)
  return { isDone, resetTour }
}
