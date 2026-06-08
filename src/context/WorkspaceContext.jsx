import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { ADMIN_EMAILS } from './RoleContext'
import { loadClockifyCache, isClockifyUser } from '../lib/clockify'
import { initDB, dbGetProjects, dbGetClients, dbGetAllTasks } from '../lib/db'

const WorkspaceContext = createContext(null)

function getInitialData(isDemo, email) {
  if (!isDemo) return { ws: null, projects: [], clients: [], members: [], tasks: [] }
  // Only pre-populate from Clockify cache if this is the Clockify owner
  if (isClockifyUser(email)) {
    const cache = loadClockifyCache()
    if (cache) return {
      ws: cache.ws,
      projects: cache.projects || [],
      clients: cache.clients || [],
      members: cache.members || [],
      tasks: [],
    }
  }
  const wsId = email?.endsWith('@fundacionxul.org') ? 'fundacion-ws-1' : 'xul-ws-1'
  const wsName = wsId === 'fundacion-ws-1' ? 'Fundación XUL' : 'XUL'
  return { ws: { id: wsId, name: wsName, working_hours_per_day: 8, alert_threshold_days: 1 }, projects: [], clients: [], members: [], tasks: [] }
}

export function WorkspaceProvider({ children }) {
  const { user, isDemo } = useAuth()
  const isAdmin = ADMIN_EMAILS.includes(user?.email)
  const init = getInitialData(isDemo, user?.email)
  const [workspace, setWorkspace] = useState(init.ws)
  const [projects, setProjects] = useState(init.projects)
  const [clients, setClients] = useState(init.clients)
  const [tasks, setTasks] = useState(init.tasks)
  const [members, setMembers] = useState(init.members)

  useEffect(() => {
    if (!user) return
    if (isDemo) {
      // Load projects, clients AND tasks from Supabase
      initDB()
        .then(() => Promise.all([dbGetProjects({ userEmail: user?.email, isAdmin }), dbGetClients(), dbGetAllTasks()]))
        .then(([neonProjects, neonClients, neonTasks]) => {
          if (neonProjects?.length) {
            setProjects(neonProjects.map(p => ({
              ...p,
              clients: p.client_name ? { name: p.client_name } : null,
            })))
          }
          if (neonClients?.length) setClients(neonClients)
          if (neonTasks?.length) setTasks(neonTasks)
        })
        .catch(console.error)
      return
    }
    loadWorkspace()
  }, [user])

  async function loadWorkspace() {
    const { data: ws } = await supabase
      .from('workspace_members')
      .select('workspaces(*)')
      .eq('user_id', user.id)
      .single()
    if (ws) {
      setWorkspace(ws.workspaces)
      loadProjects(ws.workspaces.id)
      loadClients(ws.workspaces.id)
      loadMembers(ws.workspaces.id)
    }
  }

  async function loadProjects(wsId) {
    if (isDemo) return
    const { data: allData } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('archived', false)
      .order('name')
    let data = allData || []
    // Filter by membership for non-admins
    if (!isAdmin && user?.email) {
      const { data: memberships } = await supabase.from('project_members')
        .select('project_id').eq('user_email', user.email)
      if (memberships && memberships.length > 0) {
        const myIds = new Set(memberships.map(m => m.project_id))
        data = data.filter(p => myIds.has(p.id))
      }
    }
    setProjects(data)
    if (data.length) loadTasks(data.map(p => p.id))
  }

  async function loadTasks(projectIds) {
    if (isDemo || !projectIds?.length) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds)
      .eq('archived', false)
    setTasks(data || [])
  }

  async function loadClients(wsId) {
    if (isDemo) return
    const { data } = await supabase.from('clients').select('*').eq('workspace_id', wsId).order('name')
    setClients(data || [])
  }

  async function loadMembers(wsId) {
    if (isDemo) return
    const { data } = await supabase
      .from('workspace_members')
      .select('*, profiles(full_name, avatar_url, email, job_title, hourly_rate)')
      .eq('workspace_id', wsId)
    setMembers(data || [])
  }

  const refresh = () => !isDemo && workspace && loadProjects(workspace.id)
  const getTasksForProject = (projectId) => tasks.filter(t => t.project_id === projectId)
  const markProjectArchived = (projectId) => {} // no-op

  return (
    <WorkspaceContext.Provider value={{
      workspace, projects, clients, tasks, members,
      refresh, loadProjects, loadClients, loadMembers, loadTasks, getTasksForProject,
      markProjectArchived,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
