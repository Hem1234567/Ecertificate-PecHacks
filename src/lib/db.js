/* ============================================================
   lib/db.js — IndexedDB storage layer
   ============================================================ */
const DB_NAME = 'certgen_db'
const DB_VERSION = 1
let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('templates')) {
        const ts = db.createObjectStore('templates', { keyPath: 'id' })
        ts.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('certificates')) {
        const cs = db.createObjectStore('certificates', { keyPath: 'id' })
        cs.createIndex('templateId', 'templateId')
        cs.createIndex('batchId', 'batchId')
        cs.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
  return dbPromise
}

function tx(storeName, mode) {
  return open().then((db) => db.transaction(storeName, mode).objectStore(storeName))
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export async function saveTemplate(tpl) {
  if (!tpl.id) tpl.id = uid('tpl')
  tpl.updatedAt = Date.now()
  if (!tpl.createdAt) tpl.createdAt = tpl.updatedAt
  const store = await tx('templates', 'readwrite')
  await reqP(store.put(tpl))
  return tpl
}

export async function getTemplate(id) {
  const store = await tx('templates', 'readonly')
  return reqP(store.get(id))
}

export async function allTemplates() {
  const store = await tx('templates', 'readonly')
  const all = await reqP(store.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteTemplate(id) {
  const store = await tx('templates', 'readwrite')
  await reqP(store.delete(id))
  const certs = await certificatesByTemplate(id)
  const cstore = await tx('certificates', 'readwrite')
  for (const c of certs) await reqP(cstore.delete(c.id))
}

export async function saveCertificate(cert) {
  if (!cert.id) cert.id = uid('cert')
  if (!cert.createdAt) cert.createdAt = Date.now()
  const store = await tx('certificates', 'readwrite')
  await reqP(store.put(cert))
  return cert
}

export async function getCertificate(id) {
  const store = await tx('certificates', 'readonly')
  return reqP(store.get(id))
}

export async function allCertificates() {
  const store = await tx('certificates', 'readonly')
  const all = await reqP(store.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function certificatesByTemplate(templateId) {
  const store = await tx('certificates', 'readonly')
  const idx = store.index('templateId')
  return reqP(idx.getAll(templateId))
}

export async function deleteCertificate(id) {
  const store = await tx('certificates', 'readwrite')
  return reqP(store.delete(id))
}

export async function deleteCertificates(ids) {
  const store = await tx('certificates', 'readwrite')
  for (const id of ids) await reqP(store.delete(id))
}
