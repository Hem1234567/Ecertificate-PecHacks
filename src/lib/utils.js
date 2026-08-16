/* lib/utils.js */

/** Generate a unique certificate code, e.g. CERT-A3F2-9K1B */
export function generateCertCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
  const seg = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `CERT-${seg(4)}-${seg(4)}`
}

export function slugify(str) {
  return String(str || 'certificate')
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'certificate'
}

export function fmtDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const isCsv = /\.csv$/i.test(file.name)
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      try {
        const wb = isCsv
          ? XLSX.read(reader.result, { type: 'string' })
          : XLSX.read(reader.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (!rows.length) return reject(new Error('empty sheet'))
        resolve({ headers: Object.keys(rows[0]), rows })
      } catch (e) { reject(e) }
    }
    if (isCsv) reader.readAsText(file)
    else reader.readAsArrayBuffer(file)
  })
}

export const FONT_OPTIONS = [
  { group: 'Bundled (always works offline)', fonts: ['Poppins', 'Playfair Display', 'Pacifico', 'Montserrat', 'Dancing Script', 'Roboto Slab'] },
  { group: 'System fonts (device-dependent)', fonts: ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS'] },
]
