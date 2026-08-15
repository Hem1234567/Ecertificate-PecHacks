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

export async function pushTemplate(tpl) {
  requireConnected()
  const doc = Object.assign({}, tpl)
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
  const doc = Object.assign({}, cert)
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
  const compressed = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1000
      let w = img.naturalWidth, h = img.naturalHeight
      const scale = Math.min(1, MAX / Math.max(w, h))
      w = Math.round(w * scale); h = Math.round(h * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      let q = 0.85, dataUrl
      do { dataUrl = c.toDataURL('image/jpeg', q); q -= 0.05 }
      while (dataUrl.length > 700000 && q > 0.2)
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = imageDataUrl
  })
  await db.collection('cert_shares').doc(id).set({
    id, displayName: displayName || '', imageDataUrl: compressed, createdAt: Date.now()
  })
  return id
}
