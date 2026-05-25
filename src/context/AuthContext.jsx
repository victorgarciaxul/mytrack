import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initDB, dbSignIn } from '../lib/db'

const DEMO_MODE = import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// Fallback users in case Neon isn't reachable yet (before first import)
const FALLBACK_USERS = [
  { email: 'victorgarcia@xul.es', password: 'Xul14$', name: 'Víctor García',  role: 'admin' },
  { email: 'josecastillo@xul.es', password: 'Xul14$', name: 'José Castillo',  role: 'employee' },
  { email: 'carlagarcia@xul.es',  password: 'Xul14$', name: 'Carla García',   role: 'employee' },
]

const AuthContext = createContext(null)
const DEMO_SESSION_KEY = 'mytrack-demo-user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (DEMO_MODE) {
      try {
        const saved = localStorage.getItem(DEMO_SESSION_KEY)
        return saved ? JSON.parse(saved) : null
      } catch { return null }
    }
    return null
  })
  const [loading, setLoading] = useState(!DEMO_MODE)

  useEffect(() => {
    if (DEMO_MODE) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    if (DEMO_MODE) {
      // 1. Try Neon first (has all imported Clockify users)
      // Race against a 6s timeout so cold-start latency doesn't freeze the UI
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Neon timeout')), 6000)
        )
        const neonLogin = initDB().then(() =>
          dbSignIn(email.toLowerCase().trim(), password)
        )
        const member = await Promise.race([neonLogin, timeout])
        if (member) {
          const u = {
            id: member.id,
            email: member.user_email,
            user_metadata: { full_name: member.user_name },
            role: member.role,
            clockify_user_id: member.clockify_user_id,
          }
          setUser(u)
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
          return { error: null }
        }
      } catch (err) {
        console.warn('Neon auth failed, trying fallback:', err.message)
      }

      // 2. Fallback to hardcoded users (before first import)
      const match = FALLBACK_USERS.find(
        u => u.email === email.toLowerCase().trim() && u.password === password
      )
      if (match) {
        const u = {
          id: `local-${match.email}`,
          email: match.email,
          user_metadata: { full_name: match.name },
          role: match.role,
        }
        setUser(u)
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
        return { error: null }
      }

      return { error: { message: 'Credenciales incorrectas' } }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = (email, password, name) => {
    if (DEMO_MODE) return { error: { message: 'El registro no está disponible en este modo' } }
    return supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
  }

  const signOut = () => {
    if (DEMO_MODE) {
      setUser(null)
      localStorage.removeItem(DEMO_SESSION_KEY)
      return
    }
    supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, isDemo: DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
