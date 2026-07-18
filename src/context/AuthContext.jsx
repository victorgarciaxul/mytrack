import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initDB, dbSignIn, setActiveWorkspace, clearActiveWorkspace } from '../lib/db'

// MyTrack always uses its own custom auth (workspace_members table).
// Never use Supabase Auth regardless of which Supabase project is configured.
const DEMO_MODE = true

// Fallback users for the SSO path when Supabase is unreachable (cold start / timeout).
// NOTE: passwords are intentionally NOT stored here. Credentials live only in the
// database; there is no offline password verification. This list is used solely to
// resolve name/role/workspace for a user already authenticated via AppCenter SSO.
const FALLBACK_USERS = [
  { email: 'victorgarcia@xul.es',            name: 'Víctor García',                 role: 'admin'    },
  { email: 'carlagarcia@xul.es',             name: 'Carla García',                  role: 'admin'    },
  { email: 'josecastillo@xul.es',            name: 'José Castillo',                 role: 'admin'    },
  { email: 'aidacisneros@xul.es',            name: 'Aida Cisneros',                 role: 'employee' },
  { email: 'aitorrecalde@xul.es',            name: 'Aitor RV',                      role: 'employee' },
  { email: 'alejandraperea@xul.es',          name: 'Alejandra Perea',               role: 'employee' },
  { email: 'anarojas@fundacionxul.org',      name: 'Ana Rojas',                     role: 'employee' },
  { email: 'andreabenitez@xul.es',           name: 'Andrea Benítez',                role: 'employee' },
  { email: 'asuncionblanco@xul.es',          name: 'Asunción Blanco',               role: 'employee' },
  { email: 'auximazuecos@xul.es',            name: 'Auxi Mazuecos',                 role: 'employee' },
  { email: 'cristinafernandez@xul.es',       name: 'Cristina Fernández',            role: 'employee' },
  { email: 'cristinareyes@fundacionxul.org', name: 'Cristina Reyes Baro',           role: 'employee' },
  { email: 'elenarojo@xul.es',               name: 'Elena Rojo',                    role: 'employee' },
  { email: 'inmaosuna@xul.es',               name: 'Inma Osuna',                    role: 'admin'    },
  { email: 'irenezurita@xul.es',             name: 'Irene Zurita',                  role: 'employee' },
  { email: 'javier@xul.es',                  name: 'Javier Ramírez',                role: 'employee' },
  { email: 'javierdura@xul.es',              name: 'Javier Durá',                   role: 'employee' },
  { email: 'jorgemelo@xul.es',               name: 'Jorge Melo',                    role: 'employee' },
  { email: 'joseluisacedo@xul.es',           name: 'José Luis Acedo',               role: 'employee' },
  { email: 'josemitoribio@xul.es',           name: 'Josemi Toribio',                role: 'employee' },
  { email: 'lolagravan@xul.es',              name: 'Lola Graván',                   role: 'employee' },
  { email: 'mariohurtado@xul.es',            name: 'Mario Hurtado',                 role: 'employee' },
  { email: 'mariopulido@xul.es',             name: 'Mario Pulido',                  role: 'employee' },
  { email: 'martagarcia@xul.es',             name: 'Marta García',                  role: 'employee' },
  { email: 'miguelperez@xul.es',             name: 'Miguel Pérez',                  role: 'employee' },
  { email: 'olgaalba@xul.es',                name: 'Olga Alba Fernández',           role: 'employee' },
  { email: 'pablohernandez@xul.es',          name: 'Pablo Hernández García Tapial', role: 'employee' },
  { email: 'pepegomez@xul.es',               name: 'Pepe Gómez Palas',              role: 'employee' },
  { email: 'pilarsalles@xul.es',             name: 'Pilar Sallés',                  role: 'employee' },
  { email: 'rociohernandez@xul.es',          name: 'Rocío Hernández',               role: 'employee' },
  { email: 'sandravinas@xul.es',             name: 'Sandra Viñas',                  role: 'employee' },
  { email: 'saracliment@xul.es',             name: 'Sara Climent',                  role: 'employee' },
  { email: 'saramoran@xul.es',               name: 'Sara Morán',                    role: 'employee' },
  { email: 'sarasanchez@xul.es',             name: 'Sara Sánchez',                  role: 'employee' },
  { email: 'silviamunoz@xul.es',             name: 'Silvia Muñoz',                  role: 'employee' },
  { email: 'pruebas@xul.es',                 name: 'Usuario Pruebas',               role: 'employee' },
]

const AuthContext = createContext(null)
const DEMO_SESSION_KEY = 'mytrack-demo-user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (DEMO_MODE) {
      try {
        const saved = sessionStorage.getItem(DEMO_SESSION_KEY)
        return saved ? JSON.parse(saved) : null
      } catch { return null }
    }
    return null
  })
  const [loading, setLoading] = useState(() => {
    if (!DEMO_MODE) return true
    // Si hay sso_email en la URL, empezamos en loading para evitar flash del login
    return !!new URLSearchParams(window.location.search).get('sso_email')
  })

  // SSO: auto-login cuando AppCenter pasa el email en la URL
  useEffect(() => {
    if (user) { setLoading(false); return }
    const params   = new URLSearchParams(window.location.search)
    const ssoEmail = params.get('sso_email')
    if (!ssoEmail) return

    const email = ssoEmail.toLowerCase()
    if (!email.endsWith('@xul.es') && !email.endsWith('@fundacionxul.org')) {
      setLoading(false); return
    }

    const applyUser = (member) => {
      const wsId = member.user_email.endsWith('@fundacionxul.org') ? 'fundacion-ws-1' : 'xul-ws-1'
      const u = {
        id:               member.id ?? `local-${member.user_email}`,
        email:            member.user_email,
        user_metadata:    { full_name: member.user_name ?? member.name ?? member.user_email },
        role:             member.role,
        workspace_id:     wsId,
        clockify_user_id: member.clockify_user_id ?? null,
        weekly_hours:     member.weekly_hours ?? null,
      }
      setUser(u)
      sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
      window.history.replaceState({}, '', window.location.pathname)
      setLoading(false)
    }

    import('../lib/db').then(({ supabaseClient }) =>
      supabaseClient
        .from('workspace_members')
        .select('*')
        .eq('user_email', email)
        .limit(1)
    ).then(({ data }) => {
      const member = data?.[0]
      if (member) { applyUser(member); return }
      // No está en workspace_members → buscar en FALLBACK_USERS
      const fallback = FALLBACK_USERS.find(u => u.email === email)
      if (fallback) { applyUser({ user_email: fallback.email, user_name: fallback.name, role: fallback.role }); return }
      setLoading(false)
    }).catch(() => {
      // Red caída: intentar con FALLBACK_USERS
      const fallback = FALLBACK_USERS.find(u => u.email === email)
      if (fallback) { applyUser({ user_email: fallback.email, user_name: fallback.name, role: fallback.role }); return }
      setLoading(false)
    })
  }, [])

  // In DEMO_MODE: refresh clockify_user_id from DB on every app load.
  // Users who logged in before this field was added have it missing in localStorage,
  // which breaks Clockify sync (syncEnabled = !!clockify_user_id).
  useEffect(() => {
    if (!DEMO_MODE || !user?.email) return
    import('../lib/db').then(({ supabaseClient }) =>
      supabaseClient
        .from('workspace_members')
        .select('clockify_user_id, weekly_hours')
        .eq('user_email', user.email)
        .limit(1)
    ).then(({ data: rows }) => {
      const data = rows?.[0]
      if (!data) return
      const needsUpdate =
        data.clockify_user_id !== user.clockify_user_id ||
        data.weekly_hours !== user.weekly_hours
      if (!needsUpdate) return
      const updated = { ...user, clockify_user_id: data.clockify_user_id ?? null, weekly_hours: data.weekly_hours ?? null }
      setUser(updated)
      try { sessionStorage.setItem('mytrack-demo-user', JSON.stringify(updated)) } catch {}
    }).catch(() => {})
  }, [user?.email])

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
          // Always start admins in their primary workspace (email domain based)
          // so that fundacion-ws-1 vs xul-ws-1 ordering in DB doesn't affect login
          const wsId = member.user_email.endsWith('@fundacionxul.org')
            ? 'fundacion-ws-1'
            : 'xul-ws-1'
          const u = {
            id: member.id,
            email: member.user_email,
            user_metadata: { full_name: member.user_name },
            role: member.role,
            workspace_id: wsId,
            clockify_user_id: member.clockify_user_id,
          }
          setUser(u)
          sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u))
          return { error: null }
        }
        // Supabase responded but no match → wrong credentials, do NOT fallback
        return { error: { message: 'Credenciales incorrectas' } }
      } catch {
        // On timeout/network error we cannot verify credentials without the DB.
        // Passwords live only in the database (never bundled in the client), so
        // there is no offline password fallback — fail closed.
        return { error: { message: 'Error de conexión. Inténtalo de nuevo.' } }
      }
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
      sessionStorage.removeItem(DEMO_SESSION_KEY)
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
