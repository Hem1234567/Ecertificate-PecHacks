import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as DB from '../lib/db.js'
import { draw, drawToDataUrl, loadImage, clearImageCache } from '../lib/render.js'
import { fileToDataUrl, FONT_OPTIONS } from '../lib/utils.js'
import { useToast } from '../context/ToastContext.jsx'

const DEFAULT_TEMPLATE = {
  id: null, name: '', width: 1600, height: 1131, background: null, fields: [],
}

export default function Editor() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editingId = params.get('id')

  const [template, setTemplate] = useState({ ...DEFAULT_TEMPLATE })
  const [selectedFieldId, setSelectedFieldId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [bgUrlInput, setBgUrlInput] = useState('')

  const canvasRef = useRef()
  const stageRef = useRef()
  const bgFileRef = useRef()

  // Load existing template
  useEffect(() => {
    if (!editingId) return
    DB.getTemplate(editingId).then(existing => {
      if (existing) {
        setTemplate(existing)
        if (existing.background?.type === 'url') setBgUrlInput(existing.background.src)
      }
    })
  }, [editingId])

  // Re-render canvas whenever template changes
  useEffect(() => {
    if (!canvasRef.current) return
    draw(canvasRef.current, template, null, { placeholderMode: true }).catch(() => {})
  }, [template])

  const selectedField = template.fields.find(f => f.id === selectedFieldId) || null

  function updateField(id, patch) {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...patch } : f)
    }))
  }

  function addField(preset = {}) {
    const base = {
      id: `f${Date.now()}_${Math.random().toString(36).slice(2)}`,
      key: 'field', label: 'Text Field', sample: 'Sample Text',
      xPct: 0.25, yPct: 0.45, widthPct: 0.5, fontSizePct: 0.045,
      fontFamily: 'Poppins', color: '#1a1a1a', bold: false, italic: false, align: 'center',
    }
    const f = { ...base, ...preset }
    setTemplate(prev => ({ ...prev, fields: [...prev.fields, f] }))
    setSelectedFieldId(f.id)
  }

  function removeField(id) {
    setTemplate(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== id) }))
    if (selectedFieldId === id) setSelectedFieldId(null)
  }

  // ── Drag ──────────────────────────────────────────────────────
  function startDrag(e, id) {
    e.preventDefault()
    setSelectedFieldId(id)
    const f = template.fields.find(x => x.id === id); if (!f) return
    const stageRect = stageRef.current.getBoundingClientRect()
    const startX = e.clientX, startY = e.clientY
    const startXPct = f.xPct, startYPct = f.yPct

    function onMove(ev) {
      const dx = (ev.clientX - startX) / stageRect.width
      const dy = (ev.clientY - startY) / stageRect.height
      updateField(id, {
        xPct: Math.min(1 - f.widthPct, Math.max(0, startXPct + dx)),
        yPct: Math.min(0.98 - f.fontSizePct * 1.3, Math.max(0, startYPct + dy)),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(e, id) {
    e.preventDefault(); e.stopPropagation()
    const f = template.fields.find(x => x.id === id); if (!f) return
    const stageRect = stageRef.current.getBoundingClientRect()
    const startX = e.clientX, startWidth = f.widthPct

    function onMove(ev) {
      const dx = (ev.clientX - startX) / stageRect.width
      updateField(id, { widthPct: Math.min(1 - f.xPct, Math.max(0.04, startWidth + dx)) })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Background ────────────────────────────────────────────────
  async function onBgFile(e) {
    const file = e.target.files[0]; if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      const img = await loadImage(dataUrl)
      setTemplate(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight, background: { type: 'upload', src: dataUrl } }))
      setBgUrlInput('')
      toast('Background image set', 'success')
    } catch { toast('Could not read that image file', 'error') }
    e.target.value = ''
  }

  async function loadBgUrl() {
    const url = bgUrlInput.trim(); if (!url) return
    try {
      clearImageCache(url)
      const img = await loadImage(url)
      setTemplate(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight, background: { type: 'url', src: url } }))
      toast('Background loaded from link', 'success')
    } catch { toast('Could not load image from that link — try uploading instead', 'error') }
  }

  // ── Save ──────────────────────────────────────────────────────
  async function save() {
    const name = template.name.trim()
    if (!name) { toast('Give the template a name first', 'error'); return }
    if (!template.background) { toast('Add a background image first', 'error'); return }
    setSaving(true)
    try {
      let thumbnail = ''
      try { thumbnail = await drawToDataUrl(template, null, { placeholderMode: true }) } catch { /* optional */ }
      const saved = await DB.saveTemplate({ ...template, name, thumbnail })
      toast('Template saved', 'success')
      setTimeout(() => navigate('/admin/dashboard'), 400)
    } catch { toast('Could not save template — it may be too large for storage', 'error') }
    setSaving(false)
  }

  const stageAspect = `${template.width} / ${template.height}`

  return (
    <div className="editor-shell" style={{ minHeight: '100vh' }}>
      {/* Left panel */}
      <div className="editor-panel" style={{ width: 240 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/admin/dashboard')}>← Back</button>
          <button className="btn btn-sm btn-gold" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>

        <div className="field-row">
          <label>Template name</label>
          <input type="text" value={template.name} onChange={e => setTemplate(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Participation Certificate" />
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>Background</div>
        <div className="field-row">
          <button className="btn btn-ghost btn-block" onClick={() => bgFileRef.current?.click()}>⬆ Upload Image</button>
          <input type="file" ref={bgFileRef} accept="image/*" style={{ display: 'none' }} onChange={onBgFile} />
        </div>
        <div className="field-row">
          <label>Or paste image URL</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="url" value={bgUrlInput} onChange={e => setBgUrlInput(e.target.value)} placeholder="https://…" />
            <button className="btn btn-ghost btn-sm" onClick={loadBgUrl}>Load</button>
          </div>
        </div>
        {template.background?.src && (
          <div style={{ marginBottom: 12 }}>
            <img src={template.background.src} alt="bg preview" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }} />
            <div className="hint">{template.width} × {template.height}px</div>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 16 }}>Fields</div>
        {template.fields.length === 0 && <div className="hint">No fields yet — add one below.</div>}
        {template.fields.map(f => (
          <div key={f.id} className={`field-list-item${f.id === selectedFieldId ? ' selected' : ''}`} onClick={() => setSelectedFieldId(f.id)}>
            <span>{f.label || f.key}</span>
            <button className="rm" onClick={e => { e.stopPropagation(); removeField(f.id) }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <button className="btn btn-ghost btn-block" onClick={() => addField()}>+ Add Text Field</button>
          <button className="btn btn-ghost btn-block" onClick={() => addField({ key: 'name', label: 'Participant Name', sample: 'Jane Doe', xPct: 0.18, yPct: 0.5, widthPct: 0.64, fontSizePct: 0.065, fontFamily: 'Playfair Display', bold: true, color: '#7a1f2b' })}>
            + Add Name Field
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => addField({ key: 'school', label: 'School / Institution', sample: 'Springfield High School', xPct: 0.2, yPct: 0.6, widthPct: 0.6, fontSizePct: 0.032, fontFamily: 'Poppins', color: '#222222' })}>
            + Add School Field
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="editor-canvas-wrap">
        <div ref={stageRef} className="stage-container" style={{ aspectRatio: stageAspect }}
          onPointerDown={e => { if (e.target === canvasRef.current) setSelectedFieldId(null) }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6, boxShadow: 'var(--shadow)' }} />
          {/* Drag overlay */}
          <div className="overlay">
            {template.fields.map(f => {
              const boxH = f.fontSizePct * 1.3
              return (
                <div key={f.id}
                  className={`field-box${f.id === selectedFieldId ? ' selected' : ''}`}
                  style={{ left: `${f.xPct * 100}%`, top: `${f.yPct * 100}%`, width: `${f.widthPct * 100}%`, height: `${boxH * 100}%` }}
                  onPointerDown={e => startDrag(e, f.id)}
                >
                  <span className="field-tag">{f.label || f.key}</span>
                  <div className="resize-handle" onPointerDown={e => startResize(e, f.id)} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right panel — Properties */}
      <div className="editor-panel right" style={{ width: 260 }}>
        <div className="section-title">Field Properties</div>
        {!selectedField ? (
          <div className="props-empty">Select a text field on the canvas or the list on the left to edit its properties.</div>
        ) : (
          <FieldProps field={selectedField} onUpdate={patch => updateField(selectedField.id, patch)} onDelete={() => removeField(selectedField.id)} />
        )}
      </div>
    </div>
  )
}

function FieldProps({ field: f, onUpdate, onDelete }) {
  return (
    <div>
      <div className="field-row">
        <label>Label</label>
        <input type="text" value={f.label} onChange={e => onUpdate({ label: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Sample preview text</label>
        <input type="text" value={f.sample} onChange={e => onUpdate({ sample: e.target.value })} />
        <div className="hint">Shown here in the editor. Real data replaces this when generating.</div>
      </div>
      <div className="field-row">
        <label>Column key (for Excel matching)</label>
        <input type="text" value={f.key} onChange={e => onUpdate({ key: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Font</label>
        <select value={f.fontFamily} onChange={e => onUpdate({ fontFamily: e.target.value })}>
          {FONT_OPTIONS.map(({ group, fonts }) => (
            <optgroup key={group} label={group}>
              {fonts.map(font => <option key={font} value={font}>{font}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="field-row-2">
        <div>
          <label>Size</label>
          <input type="range" min="0.012" max="0.16" step="0.001" value={f.fontSizePct}
            onChange={e => onUpdate({ fontSizePct: parseFloat(e.target.value) })} />
        </div>
        <div>
          <label>Color</label>
          <input type="color" value={f.color} onChange={e => onUpdate({ color: e.target.value })} />
        </div>
      </div>
      <div className="field-row">
        <label>Style</label>
        <div className="align-btns">
          <button className={`btn btn-sm ${f.bold ? 'btn-gold' : 'btn-ghost'}`} onClick={() => onUpdate({ bold: !f.bold })}>Bold</button>
          <button className={`btn btn-sm ${f.italic ? 'btn-gold' : 'btn-ghost'}`} onClick={() => onUpdate({ italic: !f.italic })}>Italic</button>
        </div>
      </div>
      <div className="field-row">
        <label>Alignment</label>
        <div className="pill-toggle">
          {['left', 'center', 'right'].map(a => (
            <button key={a} className={f.align === a ? 'active' : ''} onClick={() => onUpdate({ align: a })}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label>Box width</label>
        <input type="range" min="0.05" max="1" step="0.005" value={f.widthPct}
          onChange={e => onUpdate({ widthPct: parseFloat(e.target.value) })} />
      </div>
      <button className="btn btn-danger btn-block" onClick={onDelete}>Delete this field</button>
    </div>
  )
}
