import { createContext, useContext, useState } from 'react'
import { getSettings } from '../lib/settings.js'
import {
  autoConnectIfEnabled, isConnected,
  pushAdminAccount, getAdminByCredentials,
} from '../lib/firebase.js'

const AuthCtx = createContext(null)
const SESSION_KEY  = 'certgen_admin_session'
const ACCOUNTS_KEY = 'certgen_admin_accounts' // local fallback

// ── Local fallback helpers (when Firebase not connected) ─────────
function loadLocalAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}
function saveLocalAccount(account) {
  const list = loadLocalAccounts()
  list.push(account)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(() =>
    sessionStorage.getItem(SESSION_KEY) === 'true'
  )

  // ── Login (async — checks master, Firestore, then local fallback) ──
  async function login(email, password) {
    const s = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    const masterPass  = s.admin?.password || 'Admin@123'

    // 1. Master admin check (always works, no Firestore needed)
    if (email.trim().toLowerCase() === masterEmail && password === masterPass) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setLoggedIn(true)
      return true
    }

    // 2. Firestore check
    autoConnectIfEnabled()
    if (isConnected()) {
      try {
        const account = await getAdminByCredentials(email, password)
        if (account) {
          sessionStorage.setItem(SESSION_KEY, 'true')
          setLoggedIn(true)
          return true
        }
      } catch (e) {
        console.warn('[Auth] Firestore login check failed, falling back to local:', e.message)
      }
    }

    // 3. Local localStorage fallback (works offline)
    const localAccounts = loadLocalAccounts()
    const match = localAccounts.find(
      a => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
    )
    if (match) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setLoggedIn(true)
      return true
    }

    return false
  }

  // ── Register (saves to Firestore + local fallback) ──────────────
  async function register(name, email, password) {
    const s = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()

    if (email.trim().toLowerCase() === masterEmail) {
      return { ok: false, error: 'That email is already in use.' }
    }

    // Check local for duplicate
    const localAccounts = loadLocalAccounts()
    if (localAccounts.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) {
      return { ok: false, error: 'An account with that email already exists.' }
    }

    const newAccount = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: Date.now(),
    }

    // Save to Firestore
    autoConnectIfEnabled()
    if (isConnected()) {
      try {
        await pushAdminAccount(newAccount)
      } catch (e) {
        console.warn('[Auth] Could not save to Firestore, saving locally:', e.message)
        saveLocalAccount(newAccount)
      }
    } else {
      // Fallback: save only to localStorage
      saveLocalAccount(newAccount)
    }

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
