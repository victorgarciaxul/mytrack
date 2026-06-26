import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { demoMembers } from '../lib/demoData'
import { initDB, dbGetNotifications, dbMarkNotificationRead, dbMarkAllNotificationsRead } from '../lib/db'

export const ADMIN_EMAILS = [
  'josecastillo@xul.es',
  'inmaosuna@xul.es',
  'carlagarcia@xul.es',
  'victorgarcia@xul.es',
]

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [costProjects, setCostProjects] = useState(undefined) // undefined = loading, null = no access, [names] = restricted

  useEffect(() => {
    if (!user) return
    if (isDemo) {
      const me = demoMembers.find(m => m.user_id === user.id)
      // Neon-loaded role (from login) takes precedence over static demoMembers
      setRole(user?.role || me?.role || 'employee')
      setProfile(me?.profiles || null)
      // Load from Neon instead of hardcoded demo data
      loadNotificationsNeon()
      loadCostProjects()
      return
    }
    loadRole()
    loadNotifications()
  }, [user, isDemo])

  async function loadCostProjects() {
    console.log('[CP] loadCostProjects start, email=', user?.email)
    if (!user?.email) { setCostProjects(null); return }
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('cost_projects')
        .eq('user_email', user.email)
        .limit(1)
      console.log('[CP] result:', JSON.stringify({ data, error }))
      if (error) { setCostProjects(null); return }
      const row = Array.isArray(data) ? data[0] : data
      if (row?.cost_projects) {
        const arr = row.cost_projects.split(',').map(s => s.trim()).filter(Boolean)
        console.log('[CP] setting costProjects=', arr)
        setCostProjects(arr)
      } else {
        console.log('[CP] no cost_projects, setting null')
        setCostProjects(null)
      }
    } catch (e) { console.log('[CP] catch:', e); setCostProjects(null) }
  }

  async function loadNotificationsNeon() {
    if (!user?.id) return
    try {
      await initDB()
      const rows = await dbGetNotifications(user.id)
      setNotifications(rows || [])
    } catch (e) {
      console.warn('Notifications load error:', e.message)
      setNotifications([])
    }
  }

  async function loadRole() {
    const { data } = await supabase
      .from('workspace_members')
      .select('role, workspaces(id)')
      .eq('user_id', user.id)
      .single()
    if (data) setRole(data.role)

    const { data: prof } = await supabase
      .from('profiles')
      .select('job_title, hourly_rate, full_name')
      .eq('id', user.id)
      .single()
    if (prof) setProfile(prof)
  }

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function markRead(id) {
    if (isDemo) {
      try { await dbMarkNotificationRead(id) } catch {}
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      return
    }
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    loadNotifications()
  }

  async function markAllRead() {
    if (isDemo) {
      try { await dbMarkAllNotificationsRead(user.id) } catch {}
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      return
    }
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    loadNotifications()
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const isAdmin = ADMIN_EMAILS.includes(user?.email)
  const isManager = isAdmin || role === 'manager'

  return (
    <RoleContext.Provider value={{
      role, profile, isManager, isAdmin,
      notifications, unreadCount, markRead, markAllRead, costProjects,
      loadNotifications: isDemo ? loadNotificationsNeon : loadNotifications,
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export const useRole = () => useContext(RoleContext)
