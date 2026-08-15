import { fromCertificate } from '../lib/pdf.js'
import { slugify, fmtDate, downloadBlob } from '../lib/utils.js'
import { useToast } from '../context/ToastContext.jsx'

export default function CertModal({ cert, onClose, onMail, onDelete }) {
  const toast = useToast()
  const c = cert
  const dataRows = Object.entries(c.data || {}).filter(([, v]) => v !== '')

  async function downloadPdf() {
    try {
      const { blob } = await fromCertificate(c.imageDataUrl)
      downloadBlob(blob, `${slugify(c.displayName)}.pdf`)
    } catch { toast('PDF generation failed', 'error') }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>{c.displayName}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <img className="full" src={c.imageDataUrl} alt={c.displayName} />
        <div className="divider" />
        <div style={{ fontSize: 12.5, display: 'grid', gap: 4, marginBottom: 8 }}>
          {dataRows.length ? dataRows.map(([k, v]) => (
            <div key={k}><span className="muted">{k}:</span> {String(v)}</div>
          )) : <span className="muted">No extra data</span>}
        </div>
        {c.teamName && <div className="hint" style={{ color: 'var(--gold-soft)', marginBottom: 6 }}>🏷️ Team: {c.teamName}</div>}
        {c.emailSentAt && (
          <div className="hint" style={{ color: 'var(--teal)', marginBottom: 12 }}>
            ✓ Emailed to {c.emailSentTo} on {fmtDate(c.emailSentAt)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-gold" onClick={downloadPdf}>Download PDF</button>
          <button className="btn btn-ghost" onClick={onMail}>{c.emailSentAt ? 'Resend Mail' : 'Send Mail'}</button>
          <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  )
}
