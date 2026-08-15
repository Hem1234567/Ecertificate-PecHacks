import { useState, useEffect } from 'react'
import * as DB from '../lib/db.js'
import { getSettings, saveSettings, isEmailConfigured } from '../lib/settings.js'
import {
  available, isConnected, connect, autoConnectIfEnabled,
  pushTemplate, pullTemplates, pushCertificate, pullCertificates,
} from '../lib/firebase.js'
import { useToast } from '../context/ToastContext.jsx'

export default function Settings() {
  const toast = useToast()
  const [s, setS] = useState(getSettings())
  const [fbConnected, setFbConnected] = useState(isConnected())
  const [syncLog, setSyncLog] = useState('')

  useEffect(() => {
    if (autoConnectIfEnabled()) setFbConnected(isConnected())
  }, [])

  // ── Admin credentials ─────────────────────────────────────────
  function saveAdmin() {
    if (!s.admin?.email || !s.admin?.password) {
      toast('Email and password cannot be empty', 'error'); return
    }
    saveSettings({ ...s })
    toast('Admin credentials updated', 'success')
  }

  // ── EmailJS ────────────────────────────────────────────────────
  function saveEmailJs() {
    saveSettings({ ...s })
    toast('EmailJS settings saved', 'success')
  }

  // ── Firebase ──────────────────────────────────────────────────
  function saveFirebase() {
    saveSettings({ ...s })
    toast('Firebase settings saved', 'success')
  }

  function connectFb() {
    try {
      connect(s.firebase)
      setFbConnected(true)
      toast('Connected to Firebase', 'success')
    } catch (err) { toast(`Could not connect: ${err.message}`, 'error') }
  }

  function log(msg) { setSyncLog(prev => prev + msg + '\n') }

  async function pushAll() {
    if (!isConnected()) { toast('Connect to Firebase first', 'error'); return }
    setSyncLog('')
    try {
      const templates = await DB.allTemplates()
      const certs     = await DB.allCertificates()
      log(`Pushing ${templates.length} template(s)…`)
      for (const t of templates) {
        try { await pushTemplate(t); log(`✓ template: ${t.name}`) }
        catch (e) { log(`✗ template "${t.name}" failed: ${e.message}`) }
      }
      log(`Pushing ${certs.length} certificate(s)…`)
      for (const c of certs) {
        try { await pushCertificate(c); log(`✓ certificate: ${c.displayName || c.id}`) }
        catch (e) { log(`✗ certificate "${c.displayName || c.id}" failed: ${e.message}`) }
      }
      log('Push complete.')
      toast('Pushed local data to Firebase', 'success')
    } catch (err) { log(`Error: ${err.message}`) }
  }

  async function pullAll() {
    if (!isConnected()) { toast('Connect to Firebase first', 'error'); return }
    setSyncLog('')
    try {
      log('Pulling templates…')
      const templates = await pullTemplates()
      for (const t of templates) {
        try { await DB.saveTemplate(t); log(`✓ template: ${t.name}`) }
        catch (e) { log(`✗ template "${t.name}" failed: ${e.message}`) }
      }
      log('Pulling certificates…')
      const certs = await pullCertificates()
      for (const c of certs) {
        try { await DB.saveCertificate(c); log(`✓ certificate: ${c.displayName || c.id}`) }
        catch (e) { log(`✗ certificate "${c.displayName || c.id}" failed: ${e.message}`) }
      }
      log('Pull complete. Reload the Dashboard to see everything.')
      toast('Pulled data from Firebase', 'success')
    } catch (err) { log(`Error: ${err.message}`) }
  }

  const emailCfg = isEmailConfigured()

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Manage admin credentials, EmailJS, Firebase sync, and site URL.</p>
        </div>
      </div>

      {/* ── Admin credentials ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>🔐 Admin Login Credentials</div>
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          These are the credentials used to log in at <code>/admin</code>. Change them here and save.
        </p>
        <div className="field-row-2">
          <div className="field-row">
            <label>Admin Email</label>
            <input
              type="email"
              value={s.admin?.email || ''}
              onChange={e => setS(prev => ({ ...prev, admin: { ...prev.admin, email: e.target.value } }))}
              placeholder="admin@certify.com"
            />
          </div>
          <div className="field-row">
            <label>Admin Password</label>
            <input
              type="password"
              value={s.admin?.password || ''}
              onChange={e => setS(prev => ({ ...prev, admin: { ...prev.admin, password: e.target.value } }))}
              placeholder="New password"
            />
          </div>
        </div>
        <button className="btn btn-gold" onClick={saveAdmin}>Save Credentials</button>
      </div>

      {/* ── Site URL ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>🌐 Site / Hosting URL</div>
        <div className="field-row">
          <label>Public Site URL</label>
          <input
            type="url"
            value={s.siteUrl || ''}
            onChange={e => setS(prev => ({ ...prev, siteUrl: e.target.value }))}
            placeholder="https://your-app.web.app"
          />
          <div className="hint">
            Used to build the certificate download link in emails —
            e.g. <code>{(s.siteUrl || 'https://your-app.web.app').replace(/\/$/, '')}/view-certificate?id=...</code>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => { saveSettings({ ...s }); toast('Site URL saved', 'success') }}>
          Save Site URL
        </button>
      </div>

      {/* ── EmailJS ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>✉️ EmailJS</div>
          <span className={`badge ${emailCfg ? 'badge-gold' : ''}`}>{emailCfg ? 'Configured' : 'Not configured'}</span>
        </div>
        <div className="field-row-2">
          <div className="field-row">
            <label>Public Key</label>
            <input type="text" value={s.emailjs.publicKey} readOnly style={{ opacity: 0.5 }} />
          </div>
          <div className="field-row">
            <label>Service ID</label>
            <input type="text" value={s.emailjs.serviceId} readOnly style={{ opacity: 0.5 }} />
          </div>
        </div>
        <div className="field-row">
          <label>Template ID</label>
          <input type="text" value={s.emailjs.templateId} readOnly style={{ opacity: 0.5 }} />
          <div className="hint">EmailJS credentials are hardcoded. Sender name is customisable.</div>
        </div>
        <div className="field-row">
          <label>Sender / From Name</label>
          <input
            type="text"
            value={s.emailjs.fromName}
            onChange={e => setS(prev => ({ ...prev, emailjs: { ...prev.emailjs, fromName: e.target.value } }))}
            placeholder="Pechacks Organizers"
          />
        </div>
        <button className="btn btn-gold" onClick={saveEmailJs}>Save EmailJS Settings</button>
      </div>

      {/* ── Firebase ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>🔥 Firebase Cloud Sync</div>
          {!available() ? (
            <span className="badge">Library unavailable</span>
          ) : fbConnected ? (
            <span className="badge badge-gold">Connected</span>
          ) : (
            <span className="badge">Not connected</span>
          )}
        </div>
        <div className="field-row-2">
          <div className="field-row">
            <label>API Key</label>
            <input type="text" value={s.firebase.apiKey} readOnly style={{ opacity: 0.5 }} />
          </div>
          <div className="field-row">
            <label>Project ID</label>
            <input type="text" value={s.firebase.projectId} readOnly style={{ opacity: 0.5 }} />
          </div>
        </div>
        <div className="hint" style={{ marginBottom: 12 }}>Firebase credentials are hardcoded for this deployment.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn btn-gold" onClick={connectFb}>Connect to Firebase</button>
          <button className="btn btn-ghost" onClick={pushAll} disabled={!fbConnected}>⬆ Push Local → Cloud</button>
          <button className="btn btn-ghost" onClick={pullAll} disabled={!fbConnected}>⬇ Pull Cloud → Local</button>
        </div>
        {syncLog && (
          <textarea
            readOnly value={syncLog}
            style={{ height: 160, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
          />
        )}
      </div>
    </main>
  )
}
