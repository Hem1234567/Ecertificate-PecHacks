import { createContext, useContext, useState } from 'react'
import { getSettings } from '../lib/settings.js'

const AuthCtx = createContext(null)
const SESSION_KEY = 'certgen_admin_session'

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  })

  function login(email, password) {
    const s = getSettings()
    const validEmail = s.admin?.email || 'admin@certify.com'
    const validPass  = s.admin?.password || 'Admin@123'
    if (email.trim().toLowerCase() === validEmail.toLowerCase() && password === validPass) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setLoggedIn(true)
      return true
    }
    return false
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setLoggedIn(false)
  }

  return (
    <AuthCtx.Provider value={{ loggedIn, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
