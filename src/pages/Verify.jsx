import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { autoConnectIfEnabled, isConnected, getCertificateByCode } from '../lib/firebase.js'
import { draw } from '../lib/render.js'
import { fromCertificate } from '../lib/pdf.js'
import { slugify, fmtDate, downloadBlob } from '../lib/utils.js'

/* ─────────────────────────────────────────────────────────────────────────
   Verify page  —  /verify?code=CERT-XXXX-XXXX
   Public page: user enters a code, we fetch cert from Firestore,
   re-render it on canvas, then allow PDF + PNG download.
───────────────────────────────────────────────────────────────────────── */

export default function Verify() {
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('code') || '').toUpperCase())
  const [status, setStatus] = useState('idle') // idle | loading | found | notfound | error
  const [cert, setCert] = useState(null)
  const [rendered, setRendered] = useState(false) // true once canvas is drawn
  const [dlPdf, setDlPdf] = useState(false)
  const [dlImg, setDlImg] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const canvasRef = useRef(null)

  // Auto-verify if code is in URL
  useEffect(() => {
    const urlCode = params.get('code')
    if (urlCode) {
      setCode(urlCode.toUpperCase())
      verify(urlCode.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render canvas whenever cert changes
  useEffect(() => {
    if (!cert || !cert.template || !canvasRef.current) return
    setRendered(false)
    ;(async () => {
      try {
        await draw(canvasRef.current, cert.template, cert.data)
        setRendered(true)
      } catch (e) {
        console.error('Canvas render failed', e)
        setRendered(true) // still allow download of stored imageDataUrl
      }
    })()
  }, [cert])

  async function verify(overrideCode) {
    const q = (overrideCode || code).trim().toUpperCase()
    if (!q) return
    setStatus('loading')
    setCert(null)
    setRendered(false)
    setErrorMsg('')
    try {
      autoConnectIfEnabled()
      if (!isConnected()) {
        setErrorMsg('Could not connect to the verification database. Please try again.')
        setStatus('error')
        return
      }
      const data = await getCertificateByCode(q)
      if (!data) { setStatus('notfound'); return }
      setCert(data)
      setStatus('found')
    } catch (e) {
      setErrorMsg(e.message || 'An error occurred.')
      setStatus('error')
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') verify()
  }

  async function downloadPdf() {
    setDlPdf(true)
    try {
      // Prefer fresh canvas render; fall back to stored imageDataUrl
      let pngDataUrl = cert.imageDataUrl
      if (canvasRef.current && rendered) {
        pngDataUrl = canvasRef.current.toDataURL('image/png')
      }
      const { blob } = await fromCertificate(pngDataUrl)
      downloadBlob(blob, `${slugify(cert.displayName || 'certificate')}.pdf`)
    } catch (e) { console.error(e) } finally { setDlPdf(false) }
  }

  async function downloadPng() {
    setDlImg(true)
    try {
      let pngDataUrl = cert.imageDataUrl
      if (canvasRef.current && rendered) {
        pngDataUrl = canvasRef.current.toDataURL('image/png')
      }
      const res = await fetch(pngDataUrl)
      const blob = await res.blob()
      downloadBlob(blob, `${slugify(cert.displayName || 'certificate')}.png`)
    } catch (e) { console.error(e) } finally { setDlImg(false) }
  }

  /* ─── Styles ─── */
  const inputStyle = {
    width: '100%', padding: '14px 20px', borderRadius: 10, fontSize: 20,
    fontFamily: 'monospace', letterSpacing: '0.12em', fontWeight: 700,
    background: 'var(--surface-2)', border: '2px solid var(--border)',
    color: 'var(--text)', outline: 'none', textTransform: 'uppercase',
    textAlign: 'center', transition: 'border .15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px', borderBottom: '1px solid var(--border-soft)',
        background: 'var(--bg-elev)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold) 60%, var(--gold-dim) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, color: '#201703', fontSize: 13,
          }}>CG</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Certify</span>
        </Link>
        <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Certificate Verification</span>
      </nav>

      {/* ── Body ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 24px 80px',
        background: `radial-gradient(900px 600px at 50% 0%, rgba(201,162,75,0.07), transparent 60%)`,
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 560 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18,
            padding: '6px 18px', borderRadius: 999,
            background: 'rgba(201,162,75,0.1)', border: '1px solid var(--gold-dim)',
            color: 'var(--gold-soft)', fontSize: 13, fontWeight: 600,
          }}>🔍 Certificate Verification Portal</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 5vw, 42px)',
            marginBottom: 14, lineHeight: 1.2,
          }}>Verify Your Certificate</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.7 }}>
            Enter the unique certificate code printed on your certificate or shared in your email.
            We'll fetch and display the official certificate for you to download.
          </p>
        </div>

        {/* ── Input card ── */}
        <div style={{
          width: '100%', maxWidth: 520,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px 28px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
        }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
            Certificate Code
          </label>
          <input
            id="verify-code-input"
            type="text"
            placeholder="CERT-XXXX-XXXX"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            style={inputStyle}
            disabled={status === 'loading'}
            spellCheck={false}
            autoComplete="off"
          />
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, textAlign: 'center' }}>
            Example: <span style={{ fontFamily: 'monospace', color: 'var(--gold-soft)' }}>CERT-A3F2-9K1B</span>
          </div>
          <button
            id="verify-submit-btn"
            onClick={() => verify()}
            disabled={status === 'loading' || !code.trim()}
            style={{
              marginTop: 20, width: '100%', padding: '14px', borderRadius: 10, fontSize: 16,
              fontWeight: 700, fontFamily: 'var(--font-body)',
              background: status === 'loading'
                ? 'var(--surface-2)'
                : 'linear-gradient(180deg, var(--gold-soft), var(--gold))',
              color: status === 'loading' ? 'var(--text-dim)' : '#211804',
              border: '2px solid var(--gold)',
              cursor: (status === 'loading' || !code.trim()) ? 'not-allowed' : 'pointer',
              opacity: !code.trim() ? 0.5 : 1,
              transition: 'all .15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {status === 'loading' ? (
              <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> Verifying…</>
            ) : '🔍 Verify Certificate'}
          </button>
        </div>

        {/* ── Not found ── */}
        {status === 'notfound' && (
          <div style={{ marginTop: 40, textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🚫</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>Certificate Not Found</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.7 }}>
              No certificate matches the code <strong style={{ fontFamily: 'monospace', color: 'var(--gold-soft)' }}>{code}</strong>.<br />
              Double-check the code and try again, or contact the event organizer.
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ marginTop: 40, textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>Verification Error</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.7 }}>{errorMsg}</p>
          </div>
        )}

        {/* ── Found ── */}
        {status === 'found' && cert && (
          <div style={{ width: '100%', maxWidth: 860, marginTop: 48, textAlign: 'center' }}>

            {/* Congratulations pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22,
              padding: '7px 20px', borderRadius: 999,
              background: 'rgba(201,162,75,0.12)', border: '1px solid var(--gold-dim)',
              color: 'var(--gold-soft)', fontSize: 14, fontWeight: 600,
            }}>
              🎉 Congratulations, {cert.displayName || 'Participant'}!
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 4vw, 32px)', marginBottom: 8 }}>
              Certificate Verified ✓
            </h2>

            {cert.teamName && (
              <div style={{ color: 'var(--gold-soft)', fontSize: 14, marginBottom: 20 }}>
                🏷️ Team: <strong>{cert.teamName}</strong>
              </div>
            )}

            {/* Canvas (hidden — used for download) */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Certificate display */}
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              border: '2px solid var(--gold-dim)',
              boxShadow: '0 0 80px rgba(201,162,75,0.18), 0 28px 56px rgba(0,0,0,0.55)',
              marginBottom: 32, position: 'relative',
              background: 'var(--surface)',
            }}>
              {/* Show canvas render if ready, else fallback to stored imageDataUrl */}
              {rendered && canvasRef.current ? (
                <img
                  src={canvasRef.current.toDataURL('image/png')}
                  alt={`Certificate for ${cert.displayName}`}
                  style={{ width: '100%', display: 'block' }}
                />
              ) : cert.imageDataUrl ? (
                <img
                  src={cert.imageDataUrl}
                  alt={`Certificate for ${cert.displayName}`}
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                <div style={{ padding: 60, color: 'var(--text-dim)' }}>Rendering certificate…</div>
              )}

              {/* Verified badge overlay */}
              <div style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(201,162,75,0.4)',
                borderRadius: 8, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, color: 'var(--gold-soft)',
              }}>
                ✓ Verified
              </div>
            </div>

            {/* Download buttons */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
              <button
                id="download-pdf-btn"
                onClick={downloadPdf}
                disabled={dlPdf}
                style={{
                  padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(180deg, var(--gold-soft), var(--gold))',
                  color: '#211804', border: '2px solid var(--gold)',
                  cursor: dlPdf ? 'not-allowed' : 'pointer',
                  opacity: dlPdf ? 0.7 : 1,
                  boxShadow: '0 4px 24px rgba(201,162,75,0.35)',
                  transition: 'all .15s', fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                {dlPdf ? '⏳ Generating…' : '⬇ Download PDF'}
              </button>

              <button
                id="download-png-btn"
                onClick={downloadPng}
                disabled={dlImg}
                style={{
                  padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text)',
                  cursor: dlImg ? 'not-allowed' : 'pointer',
                  opacity: dlImg ? 0.7 : 1,
                  transition: 'all .15s', fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                {dlImg ? '⏳ Saving…' : '🖼 Download PNG'}
              </button>
            </div>

            {/* Details panel */}
            <div style={{
              display: 'inline-block', textAlign: 'left', minWidth: 300,
              padding: '20px 26px', borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border-soft)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12, fontWeight: 700 }}>
                Certificate Details
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'grid', gap: 7 }}>
                <Row label="Certificate Code" value={<span style={{ fontFamily: 'monospace', color: 'var(--gold-soft)', fontWeight: 700 }}>{cert.certCode}</span>} />
                <Row label="Name" value={<strong style={{ color: 'var(--text)' }}>{cert.displayName}</strong>} />
                {cert.teamName && <Row label="Team" value={<strong style={{ color: 'var(--text)' }}>{cert.teamName}</strong>} />}
                {cert.templateName && <Row label="Event" value={cert.templateName} />}
                {cert.createdAt && <Row label="Issued" value={fmtDate(cert.createdAt)} />}
              </div>
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-soft)',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--teal)',
              }}>
                <span>✓</span>
                <span>This certificate has been officially verified.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        #verify-code-input:focus { border-color: var(--gold); }
      `}</style>

      {/* ── Footer ── */}
      <footer style={{
        padding: '16px 40px', borderTop: '1px solid var(--border-soft)',
        color: 'var(--text-faint)', fontSize: 12, textAlign: 'center',
      }}>
        © {new Date().getFullYear()} Certify — Official Certificate Verification
      </footer>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ minWidth: 120, color: 'var(--text-faint)' }}>{label}:</span>
      <span>{value}</span>
    </div>
  )
}
