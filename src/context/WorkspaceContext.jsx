import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { loadClockifyCache } from '../lib/clockify'

const WorkspaceContext = createContext(null)

function getInitialData(isDemo) {
  if (!isDemo) return { ws: null, projects: [], clients: [], members: [], tasks: [] }
  const cache = loadClockifyCache()
  if (cache) return {
    ws: cache.ws,
    projects: cache.projects || [],
    clients: cache.clients || [],
    members: cache.members || [],
    tasks: [],
  }
  return { ws: { id: 'demo-ws-1', name: 'XUL', working_hours_per_day: 8, alert_threshold_days: 1 }, projects: [], clients: [], members: [], tasks: [] }
}

export function WorkspaceProvider({ children }) {
  const { user, isDemo } = useAuth()
  const init = getInitialData(isDemo)
  const [workspace, setWorkspace] = useState(init.ws)
  const [projects, setProjects] = useState(init.projects)
  const [clients, setClients] = useState(init.clients)
  const [tasks, setTasks] = useState(init.tasks)
  const [members, setMembers] = useState(init.members)

  useEffect(() => {
    if (!user || isDemo) return
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
    const { data } = await supabase
      .from('projects')
      .select('*, clients(name)')
      .eq('workspace_id', wsId)
      .eq('archived', false)
      .order('name')
    setProjects(data || [])
    if (data) loadTasks(data.map(p => p.id))
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

  return (
    <WorkspaceContext.Provider value={{
      workspace, projects, clients, tasks, members,
      refresh, loadProjects, loadClients, loadMembers, loadTasks, getTasksForProject,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
