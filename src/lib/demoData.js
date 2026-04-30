export const demoUser = {
  id: 'demo-user-1',
  email: 'demo@timetracker.com',
  user_metadata: { full_name: 'Usuario Demo' },
}

export const demoWorkspace = {
  id: 'demo-ws-1',
  name: 'Mi Empresa',
}

export const demoClients = [
  { id: 'c1', workspace_id: 'demo-ws-1', name: 'Acme Corp', email: 'contacto@acme.com' },
  { id: 'c2', workspace_id: 'demo-ws-1', name: 'Startup XYZ', email: 'hola@startup.xyz' },
  { id: 'c3', workspace_id: 'demo-ws-1', name: 'Retail S.A.', email: 'info@retail.com' },
]

export const demoProjects = [
  { id: 'p1', workspace_id: 'demo-ws-1', client_id: 'c1', name: 'Web Corporativa', color: '#6366f1', clients: { name: 'Acme Corp' } },
  { id: 'p2', workspace_id: 'demo-ws-1', client_id: 'c1', name: 'App Móvil', color: '#8b5cf6', clients: { name: 'Acme Corp' } },
  { id: 'p3', workspace_id: 'demo-ws-1', client_id: 'c2', name: 'MVP SaaS', color: '#ec4899', clients: { name: 'Startup XYZ' } },
  { id: 'p4', workspace_id: 'demo-ws-1', client_id: 'c3', name: 'E-commerce', color: '#f97316', clients: { name: 'Retail S.A.' } },
  { id: 'p5', workspace_id: 'demo-ws-1', client_id: null, name: 'Tareas internas', color: '#22c55e', clients: null },
]

export const demoMembers = [
  { id: 'm1', workspace_id: 'demo-ws-1', user_id: 'demo-user-1', role: 'owner', profiles: { full_name: 'Usuario Demo', email: 'demo@timetracker.com' } },
  { id: 'm2', workspace_id: 'demo-ws-1', user_id: 'u2', role: 'admin', profiles: { full_name: 'Ana García', email: 'ana@miempresa.com' } },
  { id: 'm3', workspace_id: 'demo-ws-1', user_id: 'u3', role: 'member', profiles: { full_name: 'Carlos López', email: 'carlos@miempresa.com' } },
  { id: 'm4', workspace_id: 'demo-ws-1', user_id: 'u4', role: 'member', profiles: { full_name: 'María Torres', email: 'maria@miempresa.com' } },
]

function makeEntry(id, projectId, description, daysAgo, startH, durationH) {
  const project = demoProjects.find(p => p.id === projectId)
  const start = new Date()
  start.setDate(start.getDate() - daysAgo)
  start.setHours(startH, 0, 0, 0)
  const end = new Date(start.getTime() + durationH * 3600 * 1000)
  return {
    id,
    workspace_id: 'demo-ws-1',
    user_id: 'demo-user-1',
    project_id: projectId,
    description,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration: durationH * 3600,
    projects: project ? { name: project.name, color: project.color, clients: project.clients } : null,
  }
}

export const demoEntries = [
  makeEntry('e1',  'p1', 'Diseño de landing page',      0, 9,  2),
  makeEntry('e2',  'p1', 'Integración de formularios',  0, 11, 1.5),
  makeEntry('e3',  'p3', 'Reunión de kickoff',          0, 14, 1),
  makeEntry('e4',  'p2', 'Prototipo pantallas login',   1, 9,  3),
  makeEntry('e5',  'p5', 'Revisión de pull requests',   1, 13, 1),
  makeEntry('e6',  'p4', 'Configuración de pasarela',   1, 15, 2),
  makeEntry('e7',  'p1', 'SEO y metadatos',             2, 10, 2.5),
  makeEntry('e8',  'p3', 'Desarrollo de API REST',      2, 12, 3),
  makeEntry('e9',  'p2', 'Testing en dispositivos',     3, 9,  2),
  makeEntry('e10', 'p4', 'Importación de catálogo',     3, 14, 1.5),
  makeEntry('e11', 'p5', 'Planificación semanal',       4, 9,  1),
  makeEntry('e12', 'p1', 'Correcciones de diseño',      4, 11, 2),
  makeEntry('e13', 'p3', 'Configuración de CI/CD',      5, 10, 2),
  makeEntry('e14', 'p2', 'Notificaciones push',         5, 13, 3),
  makeEntry('e15', 'p4', 'Optimización de imágenes',    6, 9,  1.5),
]
