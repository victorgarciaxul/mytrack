import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { demoUser } from '../lib/demoData'

const DEMO_MODE = import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const ALLOWED_EMAIL    = 'victorgarcia@xul.es'
const ALLOWED_PASSWORD = 'Xul2026'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
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
      if (email === ALLOWED_EMAIL && password === ALLOWED_PASSWORD) {
        setUser({ ...demoUser, email })
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
    if (DEMO_MODE) { setUser(null); return }
    supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, isDemo: DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
