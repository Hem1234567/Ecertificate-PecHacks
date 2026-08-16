import { createContext, useContext, useState, useEffect } from 'react'
import { getSettings } from '../lib/settings.js'
import {
  autoConnectIfEnabled,
  isConnected,
  firebaseAuthLogin,
  firebaseAuthLogout,
  firebaseAuthRegister,
  onFirebaseAuthStateChanged,
} from '../lib/firebase.js'

const AuthCtx = createContext(null)

// ── Rate-limit keys ───────────────────────────────────────────────
const LOCKOUT_KEY  = 'certgen_lockout'
const ATTEMPTS_KEY = 'certgen_login_attempts'
const MAX_ATTEMPTS   = 5
const LOCKOUT_MS     = 5 * 60 * 1000   // 5 minutes
const ATTEMPT_WINDOW = 2 * 60 * 1000   // 2 minutes

// ── Local master-admin fallback session (for offline use) ─────────
const LOCAL_SESSION_KEY  = 'certgen_local_session'
const LOCAL_SESSION_TTL  = 30 * 24 * 60 * 60 * 1000  // 30 days

function isLocalSessionValid() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || 'null')
    return raw && raw.expiry && Date.now() < raw.expiry
  } catch { return false }
}
function createLocalSession() {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ expiry: Date.now() + LOCAL_SESSION_TTL }))
}
function clearLocalSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY)
}

// ── Rate-limit helpers ────────────────────────────────────────────
function getLockoutInfo() {
  try {
    const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10)
    return (lockUntil && Date.now() < lockUntil) ? lockUntil : null
  } catch { return null }
}

function recordFailedAttempt() {
  try {
    const raw    = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
    const now    = Date.now()
    const recent = raw.filter(t => now - t < ATTEMPT_WINDOW)
    recent.push(now)
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(recent))
    if (recent.length >= MAX_ATTEMPTS) {
      const lockUntil = now + LOCKOUT_MS
      localStorage.setItem(LOCKOUT_KEY, String(lockUntil))
      localStorage.removeItem(ATTEMPTS_KEY)
      return lockUntil
    }
    return null
  } catch { return null }
}

function clearAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY)
  localStorage.removeItem(LOCKOUT_KEY)
}

// ── Provider ──────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // null = still loading, true/false = resolved
  const [loggedIn, setLoggedIn] = useState(() => isLocalSessionValid())
  const [authReady, setAuthReady] = useState(false)

  // On mount: auto-connect Firebase and subscribe to auth state
  useEffect(() => {
    autoConnectIfEnabled()

    if (isConnected()) {
      // Firebase Auth onAuthStateChanged gives us true persistent login —
      // it restores the session automatically after browser restart.
      const unsubscribe = onFirebaseAuthStateChanged((user) => {
        if (user) {
          setLoggedIn(true)
        } else {
          // Firebase says no user → only fall back to local session for master admin
          if (!isLocalSessionValid()) setLoggedIn(false)
        }
        setAuthReady(true)
      })
      return unsubscribe
    } else {
      // Firebase not available — rely on local session only
      setAuthReady(true)
    }
  }, [])

  // ── Login ──────────────────────────────────────────────────────
  async function login(email, password) {
    // 1. Brute-force lockout check
    const lockUntil = getLockoutInfo()
    if (lockUntil) {
      const secsLeft = Math.ceil((lockUntil - Date.now()) / 1000)
      return { ok: false, lockedUntil: lockUntil, secsLeft }
    }

    const s           = getSettings()
    const masterEmail = (s.admin?.email || 'admin@certify.com').toLowerCase()
    const masterPass  = s.admin?.password || 'Admin@123'
    const emailNorm   = (email || '').trim().toLowerCase()

    // 2. Master admin check (always works offline)
    if (emailNorm === masterEmail && password === masterPass) {
      clearAttempts()
      createLocalSession()
      setLoggedIn(true)
      return { ok: true }
    }

    // 3. Firebase Auth login (the primary path for registered users)
    autoConnectIfEnabled()
    if (isConnected()) {
      try {
        await firebaseAuthLogin(email, password)
        // onAuthStateChanged will set loggedIn=true automatically
        clearAttempts()
        return { ok: true }
      } catch (e) {
        // Firebase Auth errors: wrong-password, user-not-found, etc.
        const code = e.code || ''
        if (
          code === 'auth/wrong-password' ||
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/invalid-email'
        ) {
          const newLockUntil = recordFailedAttempt()
          if (newLockUntil) {
            return { ok: false, lockedUntil: newLockUntil, secsLeft: Math.ceil(LOCKOUT_MS / 1000) }
          }
          const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
          return { ok: false, attemptsLeft: MAX_ATTEMPTS - raw.length }
        }
        // Network / config error — let it fall through with a generic message
        console.warn('[Auth] Firebase login error:', e.message)
      }
    }

    // 4. No match
    const newLockUntil = recordFailedAttempt()
    if (newLockUntil) {
      return { ok: false, lockedUntil: newLockUntil, secsLeft: Math.ceil(LOCKOUT_MS / 1000) }
    }
    const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]')
    return { ok: false, attemptsLeft: MAX_ATTEMPTS - raw.length }
  }

  // ── Register ───────────────────────────────────────────────────
  async function register(name, email, password) {
    autoConnectIfEnabled()

    if (isConnected()) {
      try {
        await firebaseAuthRegister(name, email, password)
        // firebaseAuthRegister creates the user in Firebase Auth
        // onAuthStateChanged will fire but we DON'T auto-login after register —
        // sign the user out so they get redirected to the login page.
        await firebaseAuthLogout()
        return { ok: true }
      } catch (e) {
        const code = e.code || ''
        if (code === 'auth/email-already-in-use') {
          return { ok: false, error: 'An account with that email already exists.' }
        }
        if (code === 'auth/weak-password') {
          return { ok: false, error: 'Password must be at least 6 characters.' }
        }
        if (code === 'auth/invalid-email') {
          return { ok: false, error: 'Please enter a valid email address.' }
        }
        return { ok: false, error: e.message || 'Registration failed. Please try again.' }
      }
    }

    return { ok: false, error: 'Firebase is not connected. Registration requires an internet connection.' }
  }

  // ── Logout ─────────────────────────────────────────────────────
  async function logout() {
    clearLocalSession()
    clearAttempts()
    if (isConnected()) {
      try { await firebaseAuthLogout() } catch { /* ignore */ }
    }
    setLoggedIn(false)
  }

  return (
    <AuthCtx.Provider value={{ loggedIn, authReady, login, logout, register }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
