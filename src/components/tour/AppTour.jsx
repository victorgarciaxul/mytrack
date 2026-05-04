import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRole } from '../../context/RoleContext'

const TOUR_KEY = 'mytrack_tour_done'

// Steps per route: { selector, title, content, route (optional, navigate before showing) }
const EMPLOYEE_STEPS = [
  {
    target: 'body',
    placement: 'center',
    title: '👋 Bienvenido a MyTrack',
    content: 'En 30 segundos aprenderás a usar todas las funciones de la app. Puedes saltar el tutorial en cualquier momento.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-tracker"]',
    title: '⏱ Tracker',
    content: 'Aquí registras tu tiempo de trabajo. Puedes usar el timer en vivo o añadir entradas manuales.',
    route: '/tracker',
  },
  {
    target: '[data-tour="timer-bar"]',
    title: 'Timer en vivo',
    content: 'Escribe en qué estás trabajando, selecciona proyecto y tarea, y pulsa ▶ para iniciar. Al parar, el tiempo se guarda automáticamente.',
    route: '/tracker',
  },
  {
    target: '[data-tour="project-picker"]',
    title: '📁 Selector de proyecto',
    content: 'Asocia cada bloque de tiempo a un proyecto. Así los gestores pueden ver cuánto tiempo se dedica a cada cliente.',
    route: '/tracker',
  },
  {
    target: '[data-tour="manual-btn"]',
    title: '✏️ Entrada manual',
    content: 'Si olvidaste arrancar el timer, añade tiempo manualmente indicando hora de inicio y fin.',
    route: '/tracker',
  },
  {
    target: '[data-tour="entries-list"]',
    title: '📋 Historial de entradas',
    content: 'Aquí ves todas tus entradas de la semana agrupadas por día. Puedes editar la descripción o eliminar una entrada pasando el cursor por encima.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: '🔔 Alertas',
    content: 'Recibirás notificaciones cuando no hayas imputado tiempo. El número rojo indica alertas pendientes de leer.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Ajustes',
    content: 'Configura tu workspace y cuenta. Desde aquí también puedes reiniciar este tutorial cuando quieras.',
    route: '/tracker',
  },
  {
    target: 'body',
    placement: 'center',
    title: '✅ ¡Todo listo!',
    content: '¡Ya sabes usar MyTrack! Empieza registrando tu primer bloque de tiempo.',
    disableBeacon: true,
  },
]

const MANAGER_STEPS = [
  {
    target: 'body',
    placement: 'center',
    title: '👋 Bienvenido a MyTrack',
    content: 'En un minuto aprenderás todo lo que necesitas saber como gestor. Puedes saltar el tutorial en cualquier momento.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: '📊 Dashboard',
    content: 'Tu panel de control: horas del equipo esta semana, facturación estimada, consumo de presupuesto por proyecto y alertas pendientes.',
    route: '/dashboard',
  },
  {
    target: '[data-tour="kpi-cards"]',
    title: 'KPIs del equipo',
    content: 'De un vistazo: horas totales, horas facturables, facturación estimada en euros y número de alertas sin resolver.',
    route: '/dashboard',
  },
  {
    target: '[data-tour="nav-tracker"]',
    title: '⏱ Tracker',
    content: 'Tú también puedes imputar tiempo. Elige proyecto y tarea para que quede bien clasificado.',
    route: '/tracker',
  },
  {
    target: '[data-tour="timer-bar"]',
    title: 'Timer + Proyecto → Tarea',
    content: 'Primero selecciona el proyecto y aparecerá el selector de tarea. Así cada entrada queda asociada a una tarea concreta del proyecto.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-projects"]',
    title: '📁 Proyectos',
    content: 'Crea y gestiona proyectos con presupuesto de horas. Dentro de cada proyecto defines las tareas que el equipo puede seleccionar.',
    route: '/projects',
  },
  {
    target: '[data-tour="nav-reports"]',
    title: '📈 Reportes',
    content: 'Filtra por rango de fechas, proyecto o persona. Exporta a CSV para facturar al cliente.',
    route: '/reports',
  },
  {
    target: '[data-tour="nav-clients"]',
    title: '🏷 Clientes',
    content: 'Gestiona tu cartera de clientes y asócialos a proyectos para el seguimiento de facturación.',
    route: '/clients',
  },
  {
    target: '[data-tour="nav-team"]',
    title: '👥 Equipo',
    content: 'Visualiza todos los miembros del workspace, sus roles y perfiles de facturación.',
    route: '/team',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: '🔔 Alertas',
    content: 'Aquí ves las notificaciones del sistema: miembros que no han imputado, proyectos al límite de presupuesto y resúmenes semanales.',
    route: '/tracker',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Ajustes',
    content: 'Configura el nombre del workspace. Desde aquí puedes reiniciar este tutorial cuando quieras.',
    route: '/tracker',
  },
  {
    target: 'body',
    placement: 'center',
    title: '✅ ¡Todo listo!',
    content: '¡Ya dominas MyTrack! Empieza creando proyectos y asignando tareas a tu equipo.',
    disableBeacon: true,
  },
]

const ADMIN_EXTRA_STEP = {
  target: '[data-tour="nav-users"]',
  title: '👤 Usuarios (admin)',
  content: 'Como administrador puedes cambiar el rol de cualquier miembro (Empleado / Manager / Admin) y actualizar su perfil de facturación: cargo y tarifa por hora.',
  route: '/tracker',
}

const joyrideStyles = {
  options: {
    primaryColor: '#7B68EE',
    backgroundColor: '#1A1A2E',
    textColor: '#E0E0F0',
    arrowColor: '#1A1A2E',
    overlayColor: 'rgba(13,13,30,0.75)',
    zIndex: 9999,
    width: 320,
  },
  tooltip: {
    borderRadius: 16,
    border: '1px solid #2E2E4A',
    padding: '20px 22px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 8,
    color: '#fff',
  },
  tooltipContent: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#B0B0D0',
    padding: 0,
  },
  buttonNext: {
    background: 'linear-gradient(135deg,#7B68EE,#6B4EFF)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 18px',
    boxShadow: '0 4px 12px rgba(107,78,255,0.35)',
  },
  buttonBack: {
    color: '#8888A8',
    fontSize: 13,
    fontWeight: 500,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#6B6B8A',
    fontSize: 12,
  },
  buttonClose: {
    color: '#6B6B8A',
  },
  spotlight: {
    borderRadius: 12,
  },
  beaconInner: {
    backgroundColor: '#7B68EE',
  },
  beaconOuter: {
    borderColor: '#7B68EE',
    backgroundColor: 'rgba(123,104,238,0.2)',
  },
}

export default function AppTour({ run, onFinish }) {
  const { isManager, isAdmin } = useRole()
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)

  const steps = isManager
    ? [
        ...MANAGER_STEPS.slice(0, isAdmin ? 11 : 11),
        ...(isAdmin ? [ADMIN_EXTRA_STEP] : []),
        MANAGER_STEPS[MANAGER_STEPS.length - 1],
      ].filter((s, i, arr) => i === 0 || s !== arr[arr.length - 1] || i === arr.length - 1)
    : EMPLOYEE_STEPS

  const builtSteps = isManager
    ? [
        ...MANAGER_STEPS.slice(0, -1),
        ...(isAdmin ? [ADMIN_EXTRA_STEP] : []),
        MANAGER_STEPS[MANAGER_STEPS.length - 1],
      ]
    : EMPLOYEE_STEPS

  const handleCallback = useCallback((data) => {
    const { action, index, status, type } = data

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem(TOUR_KEY, 'true')
      setStepIndex(0)
      onFinish?.()
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1)
      const nextStep = builtSteps[nextIndex]
      if (nextStep?.route && nextStep.route !== location.pathname) {
        navigate(nextStep.route)
        setTimeout(() => setStepIndex(nextIndex), 300)
      } else {
        setStepIndex(nextIndex)
      }
    }
  }, [builtSteps, location.pathname, navigate, onFinish])

  // Reset step index when tour is re-triggered
  useEffect(() => {
    if (run) setStepIndex(0)
  }, [run])

  return (
    <Joyride
      steps={builtSteps}
      stepIndex={stepIndex}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableScrolling={false}
      disableOverlayClose
      styles={joyrideStyles}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: '¡Listo!',
        next: 'Siguiente',
        skip: 'Saltar tutorial',
        open: 'Abrir',
        nextLabelWithProgress: 'Siguiente ({step} de {steps})',
      }}
      callback={handleCallback}
      floaterProps={{ disableAnimation: false }}
    />
  )
}

export function useTour() {
  const isDone = () => localStorage.getItem(TOUR_KEY) === 'true'
  const resetTour = () => localStorage.removeItem(TOUR_KEY)
  return { isDone, resetTour }
}
