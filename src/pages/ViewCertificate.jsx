import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { getCertificate } from '../lib/db.js'
import { fromCertificate } from '../lib/pdf.js'
import { downloadBlob, slugify, fmtDate } from '../lib/utils.js'
import { autoConnectIfEnabled, isConnected } from '../lib/firebase.js'

async function loadFromFirebase(id) {
  try {
    autoConnectIfEnabled()
    if (!isConnected()) return null
    // access firebase via global — cert_shares collection
    const app = window.__certgenFirebaseApp
    if (!app) return null
    const db = app.firestore()
    const doc = await db.collection('cert_shares').doc(id).get()
    return doc.exists ? doc.data() : null
  } catch {
    return null
  }
}

export default function ViewCertificate() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const [cert, setCert] = useState(null)
  const [status, setStatus] = useState('loading') // loading | found | notfound
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) { setStatus('notfound'); return }
    ;(async () => {
      // 1. Try local IndexedDB first
      try {
        const local = await getCertificate(id)
        if (local && local.imageDataUrl) { setCert(local); setStatus('found'); return }
      } catch { /* skip */ }

      // 2. Try Firebase cert_shares
      try {
        autoConnectIfEnabled()
        if (isConnected()) {
          // use raw firebase global since we don't want to import the whole module
          const fbApp = [...(firebase?.apps || [])].find(a => a.name?.startsWith('certgenApp_'))
          if (fbApp) {
            const db = fbApp.firestore()
            const snap = await db.collection('cert_shares').doc(id).get()
            if (snap.exists) { setCert(snap.data()); setStatus('found'); return }
          }
        }
      } catch { /* skip */ }

      setStatus('notfound')
    })()
  }, [id])

  async function handleDownload() {
    if (!cert?.imageDataUrl) return
    setDownloading(true)
    try {
      const { blob } = await fromCertificate(cert.imageDataUrl)
      downloadBlob(blob, `${slugify(cert.displayName || 'certificate')}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
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
        <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Certificate Viewer</span>
      </nav>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 24px',
        background: `radial-gradient(900px 500px at 50% 0%, rgba(201,162,75,0.06), transparent 60%)`,
      }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 15 }}>Loading your certificate…</div>
          </div>
        )}

        {status === 'notfound' && (
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 12 }}>Certificate Not Found</h1>
            <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 24 }}>
              We couldn't find a certificate with this link. It may have expired, or the link may be incorrect.
              Please check your email for the correct link.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              Need help? <a href="mailto:support@pechacks.com" style={{ color: 'var(--teal)' }}>Contact the organizers</a>
            </p>
            <Link to="/" style={{
              display: 'inline-block', marginTop: 20, padding: '10px 24px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text)', textDecoration: 'none', fontSize: 14,
            }}>← Back to Home</Link>
          </div>
        )}

        {status === 'found' && cert && (
          <div style={{ width: '100%', maxWidth: 820, textAlign: 'center' }}>
            {/* Congrats header */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
              padding: '6px 18px', borderRadius: 999,
              background: 'rgba(201,162,75,0.12)', border: '1px solid var(--gold-dim)',
              color: 'var(--gold-soft)', fontSize: 13, fontWeight: 600,
            }}>
              🎉 Congratulations, {cert.displayName || 'Participant'}!
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 36px)',
              marginBottom: 8,
            }}>Your Certificate is Ready</h1>

            {cert.teamName && (
              <div style={{ color: 'var(--gold-soft)', fontSize: 14, marginBottom: 20 }}>
                🏷️ Team: <strong>{cert.teamName}</strong>
              </div>
            )}

            {!cert.teamName && (
              <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
                Pechacks 4.0 — High School Track
              </p>
            )}

            {/* Certificate image */}
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              border: '2px solid var(--gold-dim)',
              boxShadow: '0 0 60px rgba(201,162,75,0.15), 0 24px 48px rgba(0,0,0,0.5)',
              marginBottom: 32,
            }}>
              <img
                src={cert.imageDataUrl}
                alt={`Certificate for ${cert.displayName}`}
                style={{ width: '100%', display: 'block' }}
              />
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: '14px 40px', borderRadius: 10, fontSize: 16, fontWeight: 700,
                background: 'linear-gradient(180deg, var(--gold-soft), var(--gold))',
                color: '#211804', border: '2px solid var(--gold)',
                cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(201,162,75,0.3)',
                transition: 'all .15s', display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font-body)',
              }}
            >
              {downloading ? '⏳ Generating PDF…' : '⬇ Download Certificate (PDF)'}
            </button>

            {/* Meta */}
            <div style={{
              marginTop: 32, padding: '16px 24px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border-soft)',
              display: 'inline-block', textAlign: 'left', minWidth: 280,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontWeight: 700 }}>Certificate Details</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'grid', gap: 6 }}>
                <div><span className="muted">Name: </span><strong style={{ color: 'var(--text)' }}>{cert.displayName}</strong></div>
                {cert.teamName && <div><span className="muted">Team: </span><strong style={{ color: 'var(--text)' }}>{cert.teamName}</strong></div>}
                {cert.templateName && <div><span className="muted">Event: </span>{cert.templateName}</div>}
                {cert.createdAt && <div><span className="muted">Issued: </span>{fmtDate(cert.createdAt)}</div>}
              </div>
            </div>

            <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-faint)' }}>
              This is an official certificate issued by the Pechacks organizers.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Footer */}
      <footer style={{
        padding: '16px 40px', borderTop: '1px solid var(--border-soft)',
        color: 'var(--text-faint)', fontSize: 12, textAlign: 'center',
      }}>
        © {new Date().getFullYear()} Pechacks 4.0 · Powered by Certify
      </footer>
    </div>
  )
}
