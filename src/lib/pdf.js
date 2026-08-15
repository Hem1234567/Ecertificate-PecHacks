/* lib/pdf.js */
export function shrinkToJpeg(pngDataUrl, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxDim / Math.max(w, h))
      w = Math.round(w * scale); h = Math.round(h * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ dataUrl: c.toDataURL('image/jpeg', quality), width: w, height: h })
    }
    img.onerror = reject
    img.src = pngDataUrl
  })
}

export async function fromCertificate(pngDataUrl) {
  const { jsPDF } = window.jspdf
  const { dataUrl, width, height } = await shrinkToJpeg(pngDataUrl)
  const orientation = width >= height ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'px', format: [width, height], compress: true })
  doc.addImage(dataUrl, 'JPEG', 0, 0, width, height)
  const blob = doc.output('blob')
  const base64 = doc.output('datauristring').split(',')[1]
  return { blob, base64, width, height }
}
