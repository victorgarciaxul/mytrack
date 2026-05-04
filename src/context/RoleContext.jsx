import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { demoMembers, demoNotifications } from '../lib/demoData'

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const { user, isDemo } = useAuth()
  const [role, setRole] = useState(null)       // 'admin' | 'manager' | 'employee'
  const [profile, setProfile] = useState(null) // job_title, hourly_rate
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!user) return
    if (isDemo) {
      const me = demoMembers.find(m => m.user_id === user.id)
      setRole(me?.role || 'employee')
      setProfile(me?.profiles || null)
      setNotifications(demoNotifications.filter(n => n.user_id === user.id))
      return
    }
    loadRole()
    loadNotifications()
  }, [user, isDemo])

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
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      return
    }
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    loadNotifications()
  }

  async function markAllRead() {
    if (isDemo) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      return
    }
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    loadNotifications()
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const isManager = role === 'admin' || role === 'manager'
  const isAdmin = role === 'admin'

  return (
    <RoleContext.Provider value={{
      role, profile, isManager, isAdmin,
      notifications, unreadCount, markRead, markAllRead, loadNotifications,
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export const useRole = () => useContext(RoleContext)
