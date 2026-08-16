import { createContext, useContext, useState } from 'react'
import { getSettings } from '../lib/settings.js'

const AuthCtx = createContext(null)
const SESSION_KEY  = 'certgen_admin_session'
const ACCOUNTS_KEY = 'certgen_admin_accounts'

// ── Helpers ──────────────────────────────────────────────────────
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}
function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(() =>
    sessionStorage.getItem(SESSION_KEY) === 'true'
  )

  function login(email, password) {
    const s = getSettings()
    // Master admin from settings always works
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    const masterPass  = s.admin?.password || 'Admin@123'
    if (email.trim().toLowerCase() === masterEmail && password === masterPass) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setLoggedIn(true)
      return true
    }
    // Check registered accounts
    const accounts = loadAccounts()
    const match = accounts.find(
      a => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
    )
    if (match) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setLoggedIn(true)
      return true
    }
    return false
  }

  function register(name, email, password) {
    const s = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    if (email.trim().toLowerCase() === masterEmail) {
      return { ok: false, error: 'That email is already in use.' }
    }
    const accounts = loadAccounts()
    if (accounts.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) {
      return { ok: false, error: 'An account with that email already exists.' }
    }
    accounts.push({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: Date.now(),
    })
    saveAccounts(accounts)
    return { ok: true }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setLoggedIn(false)
  }

  return (
    <AuthCtx.Provider value={{ loggedIn, login, logout, register }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
