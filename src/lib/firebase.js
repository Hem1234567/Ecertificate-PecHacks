/* lib/firebase.js — optional cloud sync */
import { getSettings } from './settings.js'

let app = null
let db = null

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
    app = null
  }
  app = firebase.initializeApp(config, 'certgenApp_' + Date.now())
  db = app.firestore()
  return app
}

export function autoConnectIfEnabled() {
  const s = getSettings().firebase
  if (s.enabled && s.apiKey && s.authDomain && s.projectId && s.appId) {
    try {
      connect({ apiKey: s.apiKey, authDomain: s.authDomain, projectId: s.projectId,
        storageBucket: s.storageBucket, messagingSenderId: s.messagingSenderId, appId: s.appId })
      return true
    } catch (e) { console.warn('Firebase auto-connect failed', e); return false }
  }
  return false
}

function requireConnected() {
  if (!app) throw new Error('Not connected to Firebase. Go to Settings and click Connect.')
}

/**
 * Compress a base64 imageDataUrl to stay under Firestore's 1 MB field limit.
 * Returns compressed JPEG data URL, or empty string on failure.
 */
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
  // Strip thumbnail — it's a large base64 preview, not needed in Firestore
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
  // Compress imageDataUrl before pushing to stay under Firestore 1 MB limit
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

/**
 * Push a certificate (with its template snapshot) to Firestore so the
 * verify page can reconstruct it from the certCode alone.
 * Document path: certificates/{cert.id}
 *
 * imageDataUrl is compressed to stay under Firestore's 1 MB document limit.
 * The background image inside template.background.src is stripped (too large).
 */
export async function pushCertificateWithCode(cert) {
  requireConnected()

  // Compress the certificate preview image
  const compressed = await compressDataUrl(cert.imageDataUrl || '')

  // Strip the background src from the template snapshot (it's a full base64 image)
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

/**
 * Look up a certificate in Firestore by its certCode (e.g. "CERT-A3F2-9K1B").
 * Returns the doc data or null if not found.
 */
export async function getCertificateByCode(code) {
  requireConnected()
  const snap = await db.collection('certificates')
    .where('certCode', '==', code.trim().toUpperCase())
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data()
}

/**
 * Save a new admin account to Firestore (admins collection).
 */
export async function pushAdminAccount({ name, email, password }) {
  requireConnected()
  const id = 'admin_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  await db.collection('admins').doc(id).set({
    id, name: name.trim(), email: email.trim().toLowerCase(), password, createdAt: Date.now(),
  })
  return id
}

/**
 * Check Firestore for an admin with the given email + password.
 * Returns the account doc or null.
 */
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
