import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DB from '../lib/db.js'
import { drawToDataUrl } from '../lib/render.js'
import { fromCertificate } from '../lib/pdf.js'
import { sendCertificate } from '../lib/email.js'
import { isEmailConfigured, getSettings } from '../lib/settings.js'
import { slugify, fmtDate, downloadBlob, parseSpreadsheet, generateCertCode } from '../lib/utils.js'
import { autoConnectIfEnabled, isConnected, pushCertificateWithCode } from '../lib/firebase.js'
import CertModal from '../components/CertModal.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function Dashboard() {
  const toast = useToast()
  const navigate = useNavigate()

  const [templates, setTemplates] = useState([])
  const [certificates, setCertificates] = useState([])
  const [selectedTplId, setSelectedTplId] = useState('')
  const [parsedSheet, setParsedSheet] = useState(null)
  const [mapping, setMapping] = useState({})
  const [teamCol, setTeamCol] = useState('')
  const [genProgress, setGenProgress] = useState(null)
  const [sendProgress, setSendProgress] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [filterTpl, setFilterTpl] = useState('')
  const [viewCert, setViewCert] = useState(null)

  const excelRef = useRef()

  const loadTemplates = useCallback(async () => {
    setTemplates(await DB.allTemplates())
  }, [])

  const loadCertificates = useCallback(async () => {
    setCertificates(await DB.allCertificates())
    setSelected(new Set())
  }, [])

  useEffect(() => {
    loadTemplates()
    loadCertificates()
  }, [loadTemplates, loadCertificates])

  // ── Template actions ──────────────────────────────────────────
  async function deleteTemplate(id) {
    const t = templates.find(x => x.id === id)
    if (!confirm(`Delete template "${t.name}"? This also deletes every certificate from it. Cannot be undone.`)) return
    await DB.deleteTemplate(id)
    if (selectedTplId === id) { setSelectedTplId(''); setParsedSheet(null) }
    toast('Template deleted', 'success')
    await loadTemplates(); await loadCertificates()
  }

  function useTemplate(id) {
    setSelectedTplId(id)
    setParsedSheet(null); setMapping({}); setTeamCol('')
    document.getElementById('genSection')?.scrollIntoView({ behavior: 'smooth' })
  }

  // ── Excel import ──────────────────────────────────────────────
  async function onExcelChange(e) {
    const file = e.target.files[0]; if (!file) return
    if (!selectedTplId) { toast('Choose a template first', 'error'); return }
    try {
      const sheet = await parseSpreadsheet(file)
      setParsedSheet(sheet)
      // Auto-map columns
      const t = templates.find(x => x.id === selectedTplId)
      const autoMap = {}
      t.fields.forEach(f => {
        const guess = sheet.headers.find(h => h.toLowerCase().trim() === (f.key || '').toLowerCase().trim())
          || sheet.headers.find(h => h.toLowerCase().includes((f.key || '').toLowerCase()) && f.key)
        autoMap[f.id] = guess || ''
      })
      setMapping(autoMap)
      const teamGuess = sheet.headers.find(h => /^team$/i.test(h.trim())) || sheet.headers.find(h => /team/i.test(h)) || ''
      setTeamCol(teamGuess)
    } catch {
      toast('Could not read that file. Use a .xlsx, .xls or .csv file.', 'error')
      setParsedSheet(null)
    }
    e.target.value = ''
  }

  function downloadExcelTemplate() {
    const t = templates.find(x => x.id === selectedTplId)
    const headers = t && t.fields.length ? t.fields.map(f => f.label || f.key) : ['Name', 'School']
    if (!headers.some(h => /^team$/i.test(h.trim()))) headers.push('Team')
    if (!headers.some(h => /mail/i.test(h))) headers.push('Email')
    const sample = {}
    headers.forEach(h => {
      if (/mail/i.test(h)) sample[h] = 'jane.doe@example.com'
      else if (/^team$/i.test(h.trim())) sample[h] = 'Team Alpha'
      else if (/name/i.test(h)) sample[h] = 'Jane Doe'
      else if (/school|institution|college/i.test(h)) sample[h] = 'Springfield High School'
      else sample[h] = ''
    })
    const ws = XLSX.utils.json_to_sheet([sample], { header: headers })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participants')
    XLSX.writeFile(wb, `participants_template_${t ? slugify(t.name) : 'certificate'}.xlsx`)
    toast('Excel template downloaded', 'success')
  }

  // ── Generate ──────────────────────────────────────────────────
  async function generate() {
    const t = templates.find(x => x.id === selectedTplId)
    if (!t || !parsedSheet) return
    const total = parsedSheet.rows.length
    const batchId = DB.uid('batch')
    const workingFields = t.fields.map(f => ({ ...f, mappedColumn: mapping[f.id] || null }))
    const workingTemplate = { ...t, fields: workingFields }
    let done = 0

    // Try to connect Firebase for Firestore sync
    autoConnectIfEnabled()
    const firebaseReady = isConnected()

    setGenProgress({ done: 0, total })
    for (const row of parsedSheet.rows) {
      try {
        const dataUrl = await drawToDataUrl(workingTemplate, row)
        const primaryField = workingFields.find(f => f.key === 'name') || workingFields[0]
        const displayName = primaryField ? (row[primaryField.mappedColumn] || '') : ''
        const teamName = teamCol ? String(row[teamCol] || '').trim() : ''
        const certCode = generateCertCode()
        const saved = await DB.saveCertificate({
          templateId: t.id, templateName: t.name, batchId, data: row,
          displayName: String(displayName || `Row ${done + 1}`),
          teamName, imageDataUrl: dataUrl, certCode,
          // Store a lean template snapshot (background src + fields + dimensions)
          template: {
            width: workingTemplate.width,
            height: workingTemplate.height,
            background: workingTemplate.background ? { src: workingTemplate.background.src } : null,
            fields: workingFields,
          },
        })
        // Push to Firestore so /verify page can reconstruct it
        if (firebaseReady) {
          pushCertificateWithCode(saved).catch(err => console.warn('Firestore sync failed:', err))
        }
      } catch (err) { console.error('Failed row', err) }
      done++
      setGenProgress({ done, total })
      if (done % 3 === 0) await new Promise(r => setTimeout(r, 0))
    }
    toast(`${done} certificates generated`, 'success')
    setParsedSheet(null); setMapping({}); setTeamCol('')
    setGenProgress(null)
    await loadCertificates()
    document.getElementById('libSection')?.scrollIntoView({ behavior: 'smooth' })
  }

  // ── Filter ────────────────────────────────────────────────────
  const filteredCerts = certificates.filter(c => {
    if (filterTpl && c.templateId !== filterTpl) return false
    if (!search) return true
    const hay = [c.displayName, c.templateName, JSON.stringify(c.data)].join(' ').toLowerCase()
    return hay.includes(search.toLowerCase())
  })

  // ── Select ────────────────────────────────────────────────────
  function toggleSelect(id, checked) {
    setSelected(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }
  function toggleAll() {
    const allSel = filteredCerts.length && filteredCerts.every(c => selected.has(c.id))
    if (allSel) setSelected(new Set())
    else setSelected(new Set(filteredCerts.map(c => c.id)))
  }

  // ── Delete selected ───────────────────────────────────────────
  async function deleteSelected() {
    const n = selected.size; if (!n) return
    if (!confirm(`Delete ${n} certificate${n === 1 ? '' : 's'}? Cannot be undone.`)) return
    await DB.deleteCertificates([...selected])
    toast(`${n} certificate${n === 1 ? '' : 's'} deleted`, 'success')
    await loadCertificates()
  }

  // ── ZIP Export (team-wise) ────────────────────────────────────
  async function exportZip() {
    const ids = [...selected]; if (!ids.length) return
    const zip = new JSZip()
    const usedNames = {}
    for (let i = 0; i < ids.length; i++) {
      const c = certificates.find(x => x.id === ids[i]); if (!c) continue
      const rawTeam = (c.teamName || '').trim()
      const displayFolder = rawTeam || 'Ungrouped'
      if (!usedNames[displayFolder]) usedNames[displayFolder] = new Set()
      let base = slugify(c.displayName || c.id), fname = `${base}.pdf`, n = 1
      while (usedNames[displayFolder].has(fname)) { fname = `${base}_${n}.pdf`; n++ }
      usedNames[displayFolder].add(fname)
      const { blob } = await fromCertificate(c.imageDataUrl)
      zip.file(`${displayFolder}/${fname}`, blob)
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 0))
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const teamCount = Object.keys(usedNames).length
    downloadBlob(blob, `certificates_${new Date().toISOString().slice(0, 10)}.zip`)
    toast(`Exported ${ids.length} certificate${ids.length === 1 ? '' : 's'} in ${teamCount} team folder${teamCount === 1 ? '' : 's'}`, 'success')
  }

  // ── Send Mail ─────────────────────────────────────────────────
  function findEmail(cert) {
    const data = cert.data || {}
    const key = Object.keys(data).find(k => /mail/i.test(k) && data[k])
    return key ? String(data[key]).trim() : ''
  }
  function findField(data, ...patterns) {
    const key = Object.keys(data || {}).find(k => patterns.some(p => new RegExp(p, 'i').test(k.trim())))
    return key ? String(data[key]).trim() : ''
  }

  async function sendMail(certId, onDone) {
    const c = certificates.find(x => x.id === certId); if (!c) return
    if (!isEmailConfigured()) { toast('Set up EmailJS in Settings first', 'error'); return }
    let email = findEmail(c)
    if (!email) {
      email = (prompt(`No email found for "${c.displayName}". Enter one:`) || '').trim()
      if (!email) return
    }
    try {
      await sendCertificate({
        toEmail: email, participantName: c.displayName,
        teamName: findField(c.data, 'team', 'group', 'squad'),
        schoolName: findField(c.data, 'school', 'institution', 'college'),
        certId: c.id, certCode: c.certCode, imageDataUrl: c.imageDataUrl,
      })
      await DB.saveCertificate({ ...c, emailSentAt: Date.now(), emailSentTo: email })
      toast(`Certificate emailed to ${email}`, 'success')
      await loadCertificates()
      onDone && onDone()
    } catch (err) { toast(`Email failed: ${err.message}`, 'error') }
  }

  async function sendBulkMail() {
    const ids = [...selected]
    if (!ids.length) return
    if (!isEmailConfigured()) { toast('Set up EmailJS in Settings first', 'error'); return }
    if (!confirm(`Send ${ids.length} certificate${ids.length === 1 ? '' : 's'} by email?`)) return
    let sent = 0, skipped = 0, failed = 0
    setSendProgress({ sent, skipped, failed, done: 0, total: ids.length })
    for (let i = 0; i < ids.length; i++) {
      const c = certificates.find(x => x.id === ids[i])
      const email = c ? findEmail(c) : ''
      if (!c || !email) { skipped++; }
      else {
        try {
          await sendCertificate({
            toEmail: email, participantName: c.displayName,
            teamName: findField(c.data, 'team', 'group'), schoolName: findField(c.data, 'school', 'institution'),
            certId: c.id, certCode: c.certCode, imageDataUrl: c.imageDataUrl,
          })
          await DB.saveCertificate({ ...c, emailSentAt: Date.now(), emailSentTo: email })
          sent++
        } catch { failed++ }
        if (i < ids.length - 1) await new Promise(r => setTimeout(r, 1000))
      }
      setSendProgress({ sent, skipped, failed, done: i + 1, total: ids.length })
    }
    toast(`Done: ${sent} sent, ${skipped} skipped, ${failed} failed`, failed ? 'error' : 'success')
    setSendProgress(null)
    await loadCertificates()
  }

  const selT = templates.find(x => x.id === selectedTplId)

  return (
    <main className="main">
      {/* ── Templates ── */}
      <div className="page-head">
        <div>
          <h1>Templates</h1>
          <p>Design a certificate once, then generate hundreds from a spreadsheet.</p>
        </div>
      </div>
      <div className="grid">
        {templates.map(t => (
          <div key={t.id} className="tpl-card">
            <div className="tpl-thumb">
              {t.thumbnail ? <img src={t.thumbnail} alt={t.name} /> : <span className="muted">No preview</span>}
            </div>
            <div className="tpl-body">
              <div className="tpl-name">{t.name}</div>
              <div className="tpl-meta">{t.fields.length} field{t.fields.length === 1 ? '' : 's'} · saved {fmtDate(t.updatedAt)}</div>
              <div className="tpl-actions">
                <button className="btn btn-sm btn-gold" onClick={() => useTemplate(t.id)}>Use</button>
                <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/admin/editor?id=${t.id}`)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(t.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        <div className="new-tpl-card" onClick={() => navigate('/admin/editor')}>
          <div className="plus">+</div>
          <div>New Template</div>
        </div>
      </div>

      <hr className="divider" />

      {/* ── Generate ── */}
      <div id="genSection">
        <div className="page-head">
          <div>
            <h1>Generate Certificates</h1>
            <p>Pick a template, import a spreadsheet, match columns, and generate.</p>
          </div>
        </div>
        <div className="card">
          <div className="field-row">
            <label>1. Template</label>
            <select value={selectedTplId} onChange={e => { setSelectedTplId(e.target.value); setParsedSheet(null) }}>
              <option value="">Choose a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {selT && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <img src={selT.thumbnail} style={{ width: 64, height: 46, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} alt="" />
              <div><b>{selT.name}</b><div className="hint">{selT.fields.map(f => f.label).join(' · ') || 'No fields'}</div></div>
            </div>
          )}

          <div className="field-row" style={{ marginTop: 16 }}>
            <label>2. Participant spreadsheet (.xlsx, .xls or .csv)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={downloadExcelTemplate} disabled={!selectedTplId}>⬇ Download Excel Template</button>
              <button className="btn btn-ghost" onClick={() => excelRef.current?.click()}>⬆ Choose File</button>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>The downloaded sheet has all certificate fields plus a <b>Team</b> and <b>Email</b> column.</div>
            <input type="file" ref={excelRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onExcelChange} />
          </div>

          {parsedSheet && selT && (
            <div style={{ marginTop: 10 }}>
              <label>3. Match columns to certificate fields</label>
              <div className="hint" style={{ marginBottom: 12 }}>{parsedSheet.rows.length} participant row{parsedSheet.rows.length === 1 ? '' : 's'} found</div>
              {selT.fields.map(f => (
                <div key={f.id} className="field-row-2" style={{ alignItems: 'end' }}>
                  <div>
                    <label>{f.label} <span className="hint">(on certificate)</span></label>
                    <div className="badge">{f.sample || f.key}</div>
                  </div>
                  <div>
                    <label>Spreadsheet column</label>
                    <select value={mapping[f.id] || ''} onChange={e => setMapping(prev => ({ ...prev, [f.id]: e.target.value }))}>
                      <option value="">— leave blank —</option>
                      {parsedSheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {/* Team column */}
              <div className="field-row-2" style={{ alignItems: 'end', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div>
                  <label>🏷️ Team / Group column <span className="hint">(for ZIP folder grouping)</span></label>
                  <div className="badge">Creates subfolders in the exported ZIP</div>
                </div>
                <div>
                  <label>Spreadsheet column</label>
                  <select value={teamCol} onChange={e => setTeamCol(e.target.value)}>
                    <option value="">— No team grouping —</option>
                    {parsedSheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={generate} disabled={!selT.fields.length || !!genProgress}>
                ⚡ Generate Certificates
              </button>
            </div>
          )}

          {genProgress && (
            <div style={{ marginTop: 16 }}>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${Math.round((genProgress.done / genProgress.total) * 100)}%` }} />
              </div>
              <div className="hint" style={{ marginTop: 6 }}>
                {genProgress.done < genProgress.total
                  ? `Generating ${genProgress.done} / ${genProgress.total}…`
                  : `Done — ${genProgress.done} certificates generated.`}
              </div>
            </div>
          )}
        </div>
      </div>

      <hr className="divider" />

      {/* ── Library ── */}
      <div id="libSection">
        <div className="page-head">
          <div>
            <h1>Certificate Library</h1>
            <p>View, download, delete individually, or export a team-wise ZIP.</p>
          </div>
        </div>

        {certificates.length > 0 && (
          <>
            <div className="cert-toolbar">
              <input type="text" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={filterTpl} onChange={e => setFilterTpl(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="">All templates</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={toggleAll}>Select all / none</button>
              <span className="hint">{selected.size ? `${selected.size} selected` : ''}</span>
              <span style={{ flex: 1 }} />
              <button className="btn btn-ghost" disabled={selected.size === 0} onClick={exportZip}>📦 Export Selected (.zip)</button>
              <button className="btn btn-ghost" disabled={selected.size === 0} onClick={sendBulkMail}>✉️ Send Mail to Selected</button>
              <button className="btn btn-danger" disabled={selected.size === 0} onClick={deleteSelected}>Delete Selected</button>
            </div>

            {sendProgress && (
              <div style={{ marginBottom: 14 }}>
                <div className="progress-wrap">
                  <div className="progress-bar" style={{ width: `${Math.round((sendProgress.done / sendProgress.total) * 100)}%` }} />
                </div>
                <div className="hint" style={{ marginTop: 6 }}>
                  Sent {sendProgress.sent} · Skipped {sendProgress.skipped} · Failed {sendProgress.failed} — {sendProgress.done}/{sendProgress.total}
                </div>
              </div>
            )}
          </>
        )}

        {filteredCerts.length === 0 && (
          <div className="empty">
            <div className="plus-icon">✦</div>
            <div>No certificates yet — generate some above, or adjust your search.</div>
          </div>
        )}

        <div className="cert-grid">
          {filteredCerts.map(c => (
            <div key={c.id} className="cert-card">
              <div className="cert-thumb" onClick={() => setViewCert(c)}>
                <input type="checkbox" className="cert-check" checked={selected.has(c.id)}
                  onChange={e => { e.stopPropagation(); toggleSelect(c.id, e.target.checked) }}
                  onClick={e => e.stopPropagation()} />
                <img src={c.imageDataUrl} loading="lazy" alt={c.displayName} />
              </div>
              <div className="cert-info">
                <div className="name">{c.displayName || 'Untitled'}</div>
                <div className="sub">{c.templateName} · {fmtDate(c.createdAt)}</div>
                {c.teamName && <div className="sub" style={{ color: 'var(--gold-soft)' }}>🏷️ {c.teamName}</div>}
                {c.emailSentAt && <div className="sub" style={{ color: 'var(--teal)' }}>✓ Sent {fmtDate(c.emailSentAt)}</div>}
                {c.certCode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      background: 'rgba(201,162,75,0.13)', border: '1px solid var(--gold-dim)',
                      color: 'var(--gold-soft)', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.05em',
                    }}>{c.certCode}</span>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: 10, padding: '2px 7px' }}
                      title="Copy verify link"
                      onClick={() => {
                        const url = `${getSettings().siteUrl}/verify?code=${c.certCode}`
                        navigator.clipboard.writeText(url).then(() => toast('Verify link copied!', 'success'))
                      }}
                    >🔗 Copy Link</button>
                  </div>
                )}
              </div>
              <div className="cert-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setViewCert(c)}>View</button>
                <button className="btn btn-sm btn-ghost" onClick={async () => {
                  const { blob } = await fromCertificate(c.imageDataUrl)
                  downloadBlob(blob, `${slugify(c.displayName)}.pdf`)
                }}>Download</button>
                <button className="btn btn-sm btn-ghost" onClick={() => sendMail(c.id)}>
                  {c.emailSentAt ? 'Resend' : 'Send Mail'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={async () => {
                  if (!confirm('Delete this certificate? Cannot be undone.')) return
                  await DB.deleteCertificate(c.id)
                  toast('Certificate deleted', 'success')
                  await loadCertificates()
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewCert && (
        <CertModal
          cert={viewCert}
          onClose={() => setViewCert(null)}
          onMail={async () => { await sendMail(viewCert.id); setViewCert(certificates.find(x => x.id === viewCert.id) || null) }}
          onDelete={async () => {
            if (!confirm('Delete this certificate? Cannot be undone.')) return
            await DB.deleteCertificate(viewCert.id)
            toast('Certificate deleted', 'success')
            setViewCert(null); await loadCertificates()
          }}
        />
      )}
    </main>
  )
}
