import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { demoWorkspace, demoProjects, demoClients, demoMembers } from '../lib/demoData'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [workspace, setWorkspace] = useState(isDemo ? demoWorkspace : null)
  const [projects, setProjects] = useState(isDemo ? demoProjects : [])
  const [clients, setClients] = useState(isDemo ? demoClients : [])
  const [tags, setTags] = useState([])
  const [members, setMembers] = useState(isDemo ? demoMembers : [])

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
      loadTags(ws.workspaces.id)
      loadMembers(ws.workspaces.id)
    }
  }

  async function loadProjects(wsId) {
    if (isDemo) return
    const { data } = await supabase
      .from('projects')
      .select('*, clients(name, color)')
      .eq('workspace_id', wsId)
      .order('name')
    setProjects(data || [])
  }

  async function loadClients(wsId) {
    if (isDemo) return
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', wsId)
      .order('name')
    setClients(data || [])
  }

  async function loadTags(wsId) {
    if (isDemo) return
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('workspace_id', wsId)
    setTags(data || [])
  }

  async function loadMembers(wsId) {
    if (isDemo) return
    const { data } = await supabase
      .from('workspace_members')
      .select('*, profiles(full_name, avatar_url, email)')
      .eq('workspace_id', wsId)
    setMembers(data || [])
  }

  const refresh = () => !isDemo && workspace && loadProjects(workspace.id)

  return (
    <WorkspaceContext.Provider value={{ workspace, projects, clients, tags, members, refresh, loadProjects, loadClients, loadMembers }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
