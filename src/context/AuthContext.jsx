import { createContext, useContext, useState } from 'react'
import { getSettings } from '../lib/settings.js'
import {
  autoConnectIfEnabled, isConnected,
  pushAdminAccount, getAdminByCredentials,
} from '../lib/firebase.js'

const AuthCtx = createContext(null)

// ── Storage keys ─────────────────────────────────────────────────
const TOKEN_KEY    = 'certgen_auth_token'
const EXPIRY_KEY   = 'certgen_auth_expiry'
const ACCOUNTS_KEY = 'certgen_admin_accounts'
const LOCKOUT_KEY  = 'certgen_lockout'
const ATTEMPTS_KEY = 'certgen_login_attempts'

const TOKEN_TTL_MS    = 30 * 24 * 60 * 60 * 1000  // 30 days
const MAX_ATTEMPTS    = 5
const LOCKOUT_MS      = 5 * 60 * 1000              // 5 minutes
const ATTEMPT_WINDOW  = 2 * 60 * 1000              // 2 minutes

// ── Crypto helpers ────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  )
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Session helpers ───────────────────────────────────────────────
function isSessionValid() {
  try {
    const token  = localStorage.getItem(TOKEN_KEY)
    const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0', 10)
    return !!token && Date.now() < expiry
  } catch { return false }
}

function createSession() {
  const token = generateToken()
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

// ── Rate-limit helpers ────────────────────────────────────────────
function getLockoutInfo() {
  try {
    const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10)
    if (lockUntil && Date.now() < lockUntil) return lockUntil
    return null
  } catch { return null }
}

function recordFailedAttempt() {
  try {
    const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
    const now = Date.now()
    // Keep only attempts within the window
    const recent = raw.filter(t => now - t < ATTEMPT_WINDOW)
    recent.push(now)
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(recent))
    if (recent.length >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_KEY, String(now + LOCKOUT_MS))
      localStorage.removeItem(ATTEMPTS_KEY)
      return now + LOCKOUT_MS
    }
    return null
  } catch { return null }
}

function clearAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY)
  localStorage.removeItem(LOCKOUT_KEY)
}

// ── Local account helpers ─────────────────────────────────────────
function loadLocalAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}

function saveLocalAccount(account) {
  const list = loadLocalAccounts()
  list.push(account)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

// ── Provider ──────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(() => isSessionValid())

  // ── Login ──────────────────────────────────────────────────────
  async function login(email, password) {
    // 1. Check lockout
    const lockUntil = getLockoutInfo()
    if (lockUntil) {
      const secsLeft = Math.ceil((lockUntil - Date.now()) / 1000)
      return { ok: false, lockedUntil: lockUntil, secsLeft }
    }

    const s = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    const masterPass  = s.admin?.password || 'Admin@123'
    const emailNorm   = (email || '').trim().toLowerCase()

    // 2. Master admin check (plain compare — master creds come from settings)
    if (emailNorm === masterEmail && password === masterPass) {
      clearAttempts()
      createSession()
      setLoggedIn(true)
      return { ok: true }
    }

    // 3. Hash the supplied password for secure comparison
    const passwordHash = await sha256(password)

    // 4. Firestore check (hashed)
    autoConnectIfEnabled()
    if (isConnected()) {
      try {
        const account = await getAdminByCredentials(emailNorm, passwordHash)
        if (account) {
          clearAttempts()
          createSession()
          setLoggedIn(true)
          return { ok: true }
        }
      } catch (e) {
        console.warn('[Auth] Firestore login check failed, falling back to local:', e.message)
      }
    }

    // 5. Local localStorage fallback (hashed)
    const localAccounts = loadLocalAccounts()
    const match = localAccounts.find(
      a => a.email === emailNorm && a.passwordHash === passwordHash
    )
    if (match) {
      clearAttempts()
      createSession()
      setLoggedIn(true)
      return { ok: true }
    }

    // 6. Record failed attempt + return lockout info if triggered
    const newLockUntil = recordFailedAttempt()
    if (newLockUntil) {
      return { ok: false, lockedUntil: newLockUntil, secsLeft: Math.ceil(LOCKOUT_MS / 1000) }
    }

    // Return remaining attempts
    const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
    return { ok: false, attemptsLeft: MAX_ATTEMPTS - raw.length }
  }

  // ── Register (saves hashed password) ──────────────────────────
  async function register(name, email, password) {
    const s = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    const emailNorm   = (email || '').trim().toLowerCase()

    if (emailNorm === masterEmail) {
      return { ok: false, error: 'That email is already in use.' }
    }

    const localAccounts = loadLocalAccounts()
    if (localAccounts.some(a => a.email === emailNorm)) {
      return { ok: false, error: 'An account with that email already exists.' }
    }

    const passwordHash = await sha256(password)
    const newAccount = {
      name: (name || '').trim(),
      email: emailNorm,
      passwordHash,
      createdAt: Date.now(),
    }

    autoConnectIfEnabled()
    if (isConnected()) {
      try {
        await pushAdminAccount({ name: newAccount.name, email: newAccount.email, password: passwordHash })
      } catch (e) {
        console.warn('[Auth] Could not save to Firestore, saving locally:', e.message)
        saveLocalAccount(newAccount)
      }
    } else {
      saveLocalAccount(newAccount)
    }

    return { ok: true }
  }

  // ── Logout ─────────────────────────────────────────────────────
  function logout() {
    clearSession()
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
