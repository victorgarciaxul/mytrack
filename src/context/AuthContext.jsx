import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initDB, dbSignIn, setActiveWorkspace, clearActiveWorkspace } from '../lib/db'

// MyTrack always uses its own custom auth (workspace_members table).
// Never use Supabase Auth regardless of which Supabase project is configured.
const DEMO_MODE = true

// Fallback users in case Neon isn't reachable yet (cold start / timeout)
const FALLBACK_USERS = [
  { email: 'victorgarcia@xul.es',           password: 'Natural14$',   name: 'Víctor García',                 role: 'admin'    },
  { email: 'carlagarcia@xul.es',             password: 'sfdfsfff*133', name: 'Carla García',                  role: 'admin'    },
  { email: 'josecastillo@xul.es',            password: 'Mytrack14$', name: 'José Castillo',                 role: 'admin'    },
  { email: 'aidacisneros@xul.es',            password: 'Mytrack14$', name: 'Aida Cisneros',                 role: 'employee' },
  { email: 'aitorrecalde@xul.es',            password: 'Mytrack14$', name: 'Aitor RV',                      role: 'employee' },
  { email: 'alejandraperea@xul.es',          password: 'Mytrack14$', name: 'Alejandra Perea',               role: 'employee' },
  { email: 'anarojas@fundacionxul.org',      password: 'Mytrack14$', name: 'Ana Rojas',                     role: 'employee' },
  { email: 'andreabenitez@xul.es',           password: 'Mytrack14$', name: 'Andrea Benítez',                role: 'employee' },
  { email: 'asuncionblanco@xul.es',          password: 'Mytrack14$', name: 'Asunción Blanco',               role: 'employee' },
  { email: 'auximazuecos@xul.es',            password: 'Mytrack14$', name: 'Auxi Mazuecos',                 role: 'employee' },
  { email: 'cristinafernandez@xul.es',       password: 'Mytrack14$', name: 'Cristina Fernández',            role: 'employee' },
  { email: 'cristinareyes@fundacionxul.org', password: 'Mytrack14$', name: 'Cristina Reyes Baro',           role: 'employee' },
  { email: 'elenarojo@xul.es',               password: 'Mytrack14$', name: 'Elena Rojo',                    role: 'employee' },
  { email: 'inmaosuna@xul.es',               password: 'Mytrack14$', name: 'Inma Osuna',                    role: 'admin'    },
  { email: 'irenezurita@xul.es',             password: 'Mytrack14$', name: 'Irene Zurita',                  role: 'employee' },
  { email: 'javier@xul.es',                  password: 'Mytrack14$', name: 'Javier Ramírez',                role: 'employee' },
  { email: 'javierdura@xul.es',              password: 'Mytrack14$', name: 'Javier Durá',                   role: 'employee' },
  { email: 'jorgemelo@xul.es',               password: 'Mytrack14$', name: 'Jorge Melo',                    role: 'employee' },
  { email: 'joseluisacedo@xul.es',           password: 'Mytrack14$', name: 'José Luis Acedo',               role: 'employee' },
  { email: 'josemitoribio@xul.es',           password: 'Mytrack14$', name: 'Josemi Toribio',                role: 'employee' },
  { email: 'lolagravan@xul.es',              password: 'Mytrack14$', name: 'Lola Graván',                   role: 'employee' },
  { email: 'mariohurtado@xul.es',            password: 'Mytrack14$', name: 'Mario Hurtado',                 role: 'employee' },
  { email: 'mariopulido@xul.es',             password: 'Mytrack14$', name: 'Mario Pulido',                  role: 'employee' },
  { email: 'martagarcia@xul.es',             password: 'Mytrack14$', name: 'Marta García',                  role: 'employee' },
  { email: 'miguelperez@xul.es',             password: 'Mytrack14$', name: 'Miguel Pérez',                  role: 'employee' },
  { email: 'olgaalba@xul.es',                password: 'Mytrack14$', name: 'Olga Alba Fernández',           role: 'employee' },
  { email: 'pablohernandez@xul.es',          password: 'Mytrack14$', name: 'Pablo Hernández García Tapial', role: 'employee' },
  { email: 'pepegomez@xul.es',               password: 'Mytrack14$', name: 'Pepe Gómez Palas',              role: 'employee' },
  { email: 'pilarsalles@xul.es',             password: 'Mytrack14$', name: 'Pilar Sallés',                  role: 'employee' },
  { email: 'rociohernandez@xul.es',          password: 'Mytrack14$', name: 'Rocío Hernández',               role: 'employee' },
  { email: 'sandravinas@xul.es',             password: 'Mytrack14$', name: 'Sandra Viñas',                  role: 'employee' },
  { email: 'saracliment@xul.es',             password: 'Mytrack14$', name: 'Sara Climent',                  role: 'employee' },
  { email: 'saramoran@xul.es',               password: 'Mytrack14$', name: 'Sara Morán',                    role: 'employee' },
  { email: 'sarasanchez@xul.es',             password: 'Mytrack14$', name: 'Sara Sánchez',                  role: 'employee' },
  { email: 'silviamunoz@xul.es',             password: 'Mytrack14$', name: 'Silvia Muñoz',                  role: 'employee' },
  { email: 'pruebas@xul.es',                 password: 'Mytrack14$', name: 'Usuario Pruebas',                role: 'employee' },
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
      // 1. Try Supabase (source of truth — respects password changes)
      // Race against a 8s timeout so cold-start latency doesn't freeze the UI
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        )
        const dbLogin = initDB().then(() =>
          dbSignIn(email.toLowerCase().trim(), password)
        )
        const member = await Promise.race([dbLogin, timeout])
        if (member) {
          const u = {
            id: member.id,
            email: member.user_email,
            user_metadata: { full_name: member.user_name },
            role: member.role,
            workspace_id: member.workspace_id,
            clockify_user_id: member.clockify_user_id,
          }
          setUser(u)
          localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
          return { error: null }
        }
        // Supabase responded but no match → wrong credentials, do NOT fallback
        return { error: { message: 'Credenciales incorrectas' } }
      } catch (err) {
        // Only use fallback if Supabase timed out or had a network error
        if (err.message !== 'timeout' && !err.message.includes('network')) {
          return { error: { message: 'Error de conexión. Inténtalo de nuevo.' } }
        }
      }

      // 2. Emergency fallback — only reached on timeout/network failure
      const match = FALLBACK_USERS.find(
        u => u.email === email.toLowerCase().trim() && u.password === password
      )
      if (match) {
        const wsId = match.email.endsWith('@fundacionxul.org') ? 'fundacion-ws-1' : 'xul-ws-1'
        const u = {
          id: `local-${match.email}`,
          email: match.email,
          user_metadata: { full_name: match.name },
          role: match.role,
          workspace_id: wsId,
        }
        setUser(u)
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
        return { error: null }
      }

      return { error: { message: 'Error de conexión. Inténtalo de nuevo.' } }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = (email, password, name) => {
    if (DEMO_MODE) return { error: { message: 'El registro no está disponible en este modo' } }
    return supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
  }

  const signOut = () => {
    clearActiveWorkspace()
    if (DEMO_MODE) {
      setUser(null)
      localStorage.removeItem(DEMO_SESSION_KEY)
      return
    }
    supabase.auth.signOut()
  }

  /** Switch to a different workspace (admins only). Reloads the page to re-fetch all data. */
  const switchWorkspace = (wsId) => {
    setActiveWorkspace(wsId)
    window.location.reload()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, switchWorkspace, isDemo: DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
