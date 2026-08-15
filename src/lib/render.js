/* ============================================================
   lib/render.js — Canvas drawing engine
   ============================================================ */
const imgCache = new Map()

export function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src)
  const p = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load background image.'))
    img.src = src
  })
  imgCache.set(src, p)
  return p
}

export function clearImageCache(src) {
  if (src) imgCache.delete(src)
  else imgCache.clear()
}

async function fontsReady() {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch (e) { /* ignore */ }
  }
}

function resolveText(field, dataRow, placeholder) {
  if (!dataRow) return field.sample || placeholder || field.label || field.key
  const col = field.mappedColumn
  if (col && Object.prototype.hasOwnProperty.call(dataRow, col)) {
    const v = dataRow[col]
    return (v === undefined || v === null || v === '') ? '' : String(v)
  }
  return ''
}

export async function draw(canvas, template, dataRow, opts = {}) {
  const { placeholderMode = false } = opts
  const W = template.width
  const H = template.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  if (template.background && template.background.src) {
    try {
      const img = await loadImage(template.background.src)
      ctx.drawImage(img, 0, 0, W, H)
    } catch {
      ctx.fillStyle = '#f4f1ea'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#b23b3b'
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Background image failed to load', W / 2, H / 2)
    }
  } else {
    ctx.fillStyle = '#f4f1ea'
    ctx.fillRect(0, 0, W, H)
  }

  await fontsReady()

  for (const field of (template.fields || [])) {
    const text = placeholderMode
      ? (field.sample || field.label || field.key)
      : resolveText(field, dataRow, field.label)
    if (!text) continue

    const x = field.xPct * W
    const y = field.yPct * H
    const boxW = field.widthPct * W
    const fontSize = field.fontSizePct * H
    const weight = field.bold ? 'bold' : 'normal'
    const style = field.italic ? 'italic' : 'normal'
    const family = field.fontFamily || 'Poppins'

    ctx.font = `${style} ${weight} ${fontSize}px "${family}"`
    ctx.fillStyle = field.color || '#1a1a1a'
    ctx.textBaseline = 'middle'

    ctx.textAlign = field.align || 'center'
    let drawX = x
    if (field.align === 'left') drawX = x
    else if (field.align === 'right') drawX = x + boxW
    else drawX = x + boxW / 2

    const boxH = fontSize * 1.3
    const drawY = y + boxH / 2
    ctx.fillText(text, drawX, drawY, boxW)
  }
  return canvas
}

export async function drawToDataUrl(template, dataRow, opts) {
  const canvas = document.createElement('canvas')
  await draw(canvas, template, dataRow, opts)
  return canvas.toDataURL('image/png')
}
