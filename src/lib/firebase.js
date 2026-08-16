/* lib/firebase.js — optional cloud sync + Firebase Auth */
import { getSettings } from './settings.js'

let app  = null
let db   = null
let auth = null

export function available() {
  return typeof firebase !== 'undefined'
}

export function isConnected() {
  return !!app
}

export function connect(config) {
  if (!available()) throw new Error('Firebase library did not load.')
  if (app) {
    try { app.delete && app.delete() } catch { /* ignore */ }
    app  = null
    db   = null
    auth = null
  }
  // Use a stable app name so we don't create duplicates on re-connect
  try {
    app = firebase.app('certgenApp')
  } catch {
    app = firebase.initializeApp(config, 'certgenApp')
  }
  db   = app.firestore()
  auth = app.auth()
  // Persist auth session across browser restarts
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {})
  return app
}

export function autoConnectIfEnabled() {
  if (isConnected()) return true
  const s = getSettings().firebase
  if (s.enabled && s.apiKey && s.authDomain && s.projectId && s.appId) {
    try {
      connect({
        apiKey: s.apiKey, authDomain: s.authDomain, projectId: s.projectId,
        storageBucket: s.storageBucket, messagingSenderId: s.messagingSenderId, appId: s.appId,
      })
      return true
    } catch (e) { console.warn('Firebase auto-connect failed', e); return false }
  }
  return false
}

function requireConnected() {
  if (!app) throw new Error('Not connected to Firebase. Go to Settings and click Connect.')
}

// ── Firebase Auth helpers ─────────────────────────────────────────

/**
 * Register a new user with Firebase Authentication.
 * Also writes their display name to Firestore `admins` collection.
 */
export async function firebaseAuthRegister(name, email, password) {
  requireConnected()
  const cred = await auth.createUserWithEmailAndPassword(email.trim(), password)
  // Update display name in Firebase Auth profile
  await cred.user.updateProfile({ displayName: name.trim() })
  // Also write to Firestore admins collection for app-level data
  const id = 'admin_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  await db.collection('admins').doc(id).set({
    id,
    uid:       cred.user.uid,
    name:      name.trim(),
    email:     email.trim().toLowerCase(),
    createdAt: Date.now(),
  })
  return cred.user
}

/**
 * Sign in with Firebase Authentication.
 * Returns the Firebase User or throws on failure.
 */
export async function firebaseAuthLogin(email, password) {
  requireConnected()
  const cred = await auth.signInWithEmailAndPassword(email.trim(), password)
  return cred.user
}

/**
 * Sign out from Firebase Authentication.
 */
export async function firebaseAuthLogout() {
  if (auth) await auth.signOut()
}

/**
 * Subscribe to Firebase Auth state changes.
 * Calls `callback(user)` whenever auth state changes.
 * Returns an unsubscribe function.
 */
export function onFirebaseAuthStateChanged(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return auth.onAuthStateChanged(callback)
}

/**
 * Returns the current Firebase Auth user synchronously (may be null).
 */
export function getCurrentFirebaseUser() {
  return auth ? auth.currentUser : null
}

// ── Firestore helpers — image compression ─────────────────────────

async function compressDataUrl(dataUrl, maxBytes = 700000) {
  if (!dataUrl) return ''
  if (dataUrl.length <= maxBytes) return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 900
      let w = img.naturalWidth, h = img.naturalHeight
      const scale = Math.min(1, MAX / Math.max(w, h))
      w = Math.round(w * scale); h = Math.round(h * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      let q = 0.82, result
      do {
        result = c.toDataURL('image/jpeg', q)
        q -= 0.06
      } while (result.length > maxBytes && q > 0.15)
      resolve(result.length <= maxBytes ? result : '')
    }
    img.onerror = () => resolve('')
    img.src = dataUrl
  })
}

export async function pushTemplate(tpl) {
  requireConnected()
  const doc = Object.assign({}, tpl, { thumbnail: '' })
  await db.collection('templates').doc(tpl.id).set(doc)
  return doc
}

export async function pullTemplates() {
  requireConnected()
  const snap = await db.collection('templates').get()
  return snap.docs.map(d => d.data())
}

export async function pushCertificate(cert) {
  requireConnected()
  const compressed = await compressDataUrl(cert.imageDataUrl || '')
  const doc = Object.assign({}, cert, { imageDataUrl: compressed })
  await db.collection('certificates').doc(cert.id).set(doc)
  return doc
}

export async function pullCertificates() {
  requireConnected()
  const snap = await db.collection('certificates').get()
  return snap.docs.map(d => d.data())
}

export async function pushCertShare(id, imageDataUrl, displayName) {
  requireConnected()
  const compressed = await compressDataUrl(imageDataUrl, 700000)
  await db.collection('cert_shares').doc(id).set({
    id, displayName: displayName || '', imageDataUrl: compressed, createdAt: Date.now()
  })
  return id
}

export async function pushCertificateWithCode(cert) {
  requireConnected()
  const compressed = await compressDataUrl(cert.imageDataUrl || '')
  const templateSnapshot = cert.template
    ? {
        ...cert.template,
        background: cert.template.background
          ? { ...cert.template.background, src: '' }
          : null,
      }
    : null

  const doc = {
    id:           cert.id,
    certCode:     cert.certCode,
    displayName:  cert.displayName  || '',
    teamName:     cert.teamName     || '',
    templateName: cert.templateName || '',
    templateId:   cert.templateId   || '',
    data:         cert.data         || {},
    template:     templateSnapshot,
    imageDataUrl: compressed,
    createdAt:    cert.createdAt    || Date.now(),
    batchId:      cert.batchId      || '',
  }
  await db.collection('certificates').doc(cert.id).set(doc)
  return doc
}

export async function getCertificateByCode(code) {
  requireConnected()
  const snap = await db.collection('certificates')
    .where('certCode', '==', code.trim().toUpperCase())
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data()
}

/** @deprecated — kept for backward compat; new registrations use firebaseAuthRegister */
export async function pushAdminAccount({ name, email, password }) {
  requireConnected()
  const id = 'admin_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  await db.collection('admins').doc(id).set({
    id, name: name.trim(), email: email.trim().toLowerCase(), password, createdAt: Date.now(),
  })
  return id
}

/** @deprecated — new logins use firebaseAuthLogin */
export async function getAdminByCredentials(email, password) {
  requireConnected()
  const snap = await db.collection('admins')
    .where('email', '==', email.trim().toLowerCase())
    .where('password', '==', password)
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data()
}
