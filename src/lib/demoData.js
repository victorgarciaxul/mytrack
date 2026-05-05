// ── Users ──────────────────────────────────────────────────
export const demoUser = {
  id: 'demo-user-1',
  email: 'victorgarcia@xul.es',
  user_metadata: { full_name: 'Víctor García' },
}

export const demoWorkspace = {
  id: 'demo-ws-1',
  name: 'XUL Agency',
  working_hours_per_day: 8,
  alert_threshold_days: 1,
}

// ── Members (con perfiles de facturación) ─────────────────
export const demoMembers = [
  {
    id: 'm1', workspace_id: 'demo-ws-1', user_id: 'demo-user-1', role: 'admin',
    profiles: { full_name: 'Víctor García', email: 'victorgarcia@xul.es', job_title: 'Director', hourly_rate: 95 },
  },
  {
    id: 'm2', workspace_id: 'demo-ws-1', user_id: 'u2', role: 'manager',
    profiles: { full_name: 'Ana García', email: 'ana@xul.es', job_title: 'Jefa de Proyecto', hourly_rate: 75 },
  },
  {
    id: 'm3', workspace_id: 'demo-ws-1', user_id: 'u3', role: 'employee',
    profiles: { full_name: 'Carlos López', email: 'carlos@xul.es', job_title: 'Consultor Marketing', hourly_rate: 55 },
  },
  {
    id: 'm4', workspace_id: 'demo-ws-1', user_id: 'u4', role: 'employee',
    profiles: { full_name: 'María Torres', email: 'maria@xul.es', job_title: 'Diseñadora UX', hourly_rate: 60 },
  },
  {
    id: 'm5', workspace_id: 'demo-ws-1', user_id: 'u5', role: 'employee',
    profiles: { full_name: 'Pedro Ruiz', email: 'pedro@xul.es', job_title: 'Desarrollador', hourly_rate: 65 },
  },
]

// ── Clients ───────────────────────────────────────────────
export const demoClients = [
  { id: 'c1', workspace_id: 'demo-ws-1', name: 'Acme Corp', email: 'contacto@acme.com' },
  { id: 'c2', workspace_id: 'demo-ws-1', name: 'Startup XYZ', email: 'hola@startup.xyz' },
  { id: 'c3', workspace_id: 'demo-ws-1', name: 'Retail S.A.', email: 'info@retail.com' },
]

// ── Projects ──────────────────────────────────────────────
export const demoProjects = [
  { id: 'p1', workspace_id: 'demo-ws-1', client_id: 'c1', name: 'Estructura XUL', color: '#7B68EE', budget_hours: 120, clients: { name: 'Acme Corp' } },
  { id: 'p2', workspace_id: 'demo-ws-1', client_id: 'c1', name: 'XUL -Grupos de trabajo', color: '#8b5cf6', budget_hours: 200, clients: { name: 'Acme Corp' } },
  { id: 'p3', workspace_id: 'demo-ws-1', client_id: 'c2', name: 'XUL Miscelánea', color: '#ec4899', budget_hours: 150, clients: { name: 'Startup XYZ' } },
  { id: 'p4', workspace_id: 'demo-ws-1', client_id: 'c3', name: 'XUL Propuestas y concursos', color: '#f97316', budget_hours: 80, clients: { name: 'Retail S.A.' } },
  { id: 'p5', workspace_id: 'demo-ws-1', client_id: null, name: 'Xul proyectos', color: '#22c55e', budget_hours: null, clients: null },
]

// ── Tasks ─────────────────────────────────────────────────
export const demoTasks = [
  { id: 't1',  project_id: 'p1', name: 'Diseño UI/UX',          estimated_hours: 20 },
  { id: 't2',  project_id: 'p1', name: 'Desarrollo frontend',   estimated_hours: 40 },
  { id: 't3',  project_id: 'p1', name: 'SEO y contenidos',      estimated_hours: 15 },
  { id: 't4',  project_id: 'p1', name: 'QA y pruebas',          estimated_hours: 10 },
  { id: 't5',  project_id: 'p2', name: 'Arquitectura',          estimated_hours: 30 },
  { id: 't6',  project_id: 'p2', name: 'Desarrollo iOS',        estimated_hours: 60 },
  { id: 't7',  project_id: 'p2', name: 'Desarrollo Android',    estimated_hours: 60 },
  { id: 't8',  project_id: 'p3', name: 'Análisis de negocio',   estimated_hours: 20 },
  { id: 't9',  project_id: 'p3', name: 'Backend API',           estimated_hours: 50 },
  { id: 't10', project_id: 'p3', name: 'Panel de administración', estimated_hours: 30 },
  { id: 't11', project_id: 'p4', name: 'Catálogo de productos', estimated_hours: 25 },
  { id: 't12', project_id: 'p4', name: 'Pasarela de pago',      estimated_hours: 20 },
  { id: 't13', project_id: 'p5', name: 'Reuniones internas',    estimated_hours: null },
  { id: 't14', project_id: 'p5', name: 'Formación',             estimated_hours: null },
]

// ── Time entries ──────────────────────────────────────────
function makeEntry(id, userId, projectId, taskId, description, daysAgo, startH, durationH) {
  const project = demoProjects.find(p => p.id === projectId)
  const task = demoTasks.find(t => t.id === taskId)
  const start = new Date()
  start.setDate(start.getDate() - daysAgo)
  start.setHours(startH, 0, 0, 0)
  const end = new Date(start.getTime() + durationH * 3600 * 1000)
  return {
    id, workspace_id: 'demo-ws-1', user_id: userId,
    project_id: projectId, task_id: taskId,
    description,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration: durationH * 3600,
    billable: projectId !== 'p5',
    projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
    tasks: task ? { name: task.name } : null,
  }
}

export const demoEntries = [
  makeEntry('e1',  'demo-user-1', 'p1', 't1', 'Diseño landing page',        0, 9,   2),
  makeEntry('e2',  'demo-user-1', 'p1', 't2', 'Integración formularios',    0, 11,  1.5),
  makeEntry('e3',  'demo-user-1', 'p3', 't8', 'Reunión de kickoff',         0, 14,  1),
  makeEntry('e4',  'u3',          'p1', 't3', 'Redacción de contenidos',    0, 9,   3),
  makeEntry('e5',  'u4',          'p1', 't1', 'Wireframes mobile',          0, 10,  2),
  makeEntry('e6',  'demo-user-1', 'p2', 't5', 'Prototipo pantallas login',  1, 9,   3),
  makeEntry('e7',  'u5',          'p2', 't6', 'Setup proyecto iOS',         1, 9,   4),
  makeEntry('e8',  'u3',          'p4', 't11','Importación catálogo',       1, 13,  2),
  makeEntry('e9',  'u4',          'p3', 't10','Diseño panel admin',         1, 11,  3),
  makeEntry('e10', 'demo-user-1', 'p1', 't3', 'SEO y metadatos',            2, 10,  2.5),
  makeEntry('e11', 'u5',          'p3', 't9', 'Desarrollo API REST',        2, 9,   4),
  makeEntry('e12', 'u3',          'p1', 't3', 'Blog posts cliente',         2, 14,  2),
  makeEntry('e13', 'demo-user-1', 'p2', 't5', 'Revisión arquitectura',      3, 9,   2),
  makeEntry('e14', 'u4',          'p2', 't6', 'UI componentes iOS',         3, 10,  3),
  makeEntry('e15', 'u5',          'p4', 't12','Integración Stripe',         3, 9,   3),
  makeEntry('e16', 'u3',          'p5', 't13','Reunión semanal equipo',     4, 9,   1),
  makeEntry('e17', 'demo-user-1', 'p5', 't13','Planning sprint',            4, 10,  1),
  makeEntry('e18', 'u4',          'p1', 't4', 'Testing responsive',         4, 11,  2),
  makeEntry('e19', 'u5',          'p2', 't7', 'Setup Android',              5, 9,   4),
  makeEntry('e20', 'u3',          'p3', 't8', 'Análisis competencia',       5, 14,  2),
]

// ── Notifications ─────────────────────────────────────────
const now = new Date()
const hAgo = h => new Date(now - h * 3600000).toISOString()

export const demoNotifications = [
  {
    id: 'n1', workspace_id: 'demo-ws-1', user_id: 'demo-user-1',
    type: 'unlogged_time',
    title: '⚠️ Tiempo no imputado',
    message: 'Carlos López no ha imputado tiempo hoy. Lleva 1 día sin registrar.',
    read: false, created_at: hAgo(2),
  },
  {
    id: 'n2', workspace_id: 'demo-ws-1', user_id: 'demo-user-1',
    type: 'budget_warning',
    title: '📊 Presupuesto al 80%',
    message: 'El proyecto "Web Corporativa" ha consumido el 80% del presupuesto (96h de 120h).',
    read: false, created_at: hAgo(5),
  },
  {
    id: 'n3', workspace_id: 'demo-ws-1', user_id: 'demo-user-1',
    type: 'weekly_summary',
    title: '📋 Resumen semanal',
    message: 'Esta semana el equipo ha imputado 87h. Objetivo: 160h (5 personas × 8h × 4 días).',
    read: true, created_at: hAgo(24),
  },
  {
    id: 'n4', workspace_id: 'demo-ws-1', user_id: 'u3',
    type: 'unlogged_time',
    title: '⏰ Recuerda imputar tu tiempo',
    message: 'No has registrado tiempo hoy. No olvides imputar antes de finalizar la jornada.',
    read: false, created_at: hAgo(3),
  },
]
