/* lib/email.js */
import { getSettings } from './settings.js'
import { isConnected, pushCertShare } from './firebase.js'

function readError(err) {
  if (!err) return 'Unknown error'
  if (typeof err === 'object' && 'status' in err && 'text' in err)
    return `EmailJS ${err.status}: ${err.text}`
  if (typeof err === 'string') return err
  if (err.message) return err.message
  try { return JSON.stringify(err) } catch { return String(err) }
}

export async function sendCertificate(opts) {
  if (typeof emailjs === 'undefined')
    throw new Error('EmailJS library not loaded — check your internet connection.')

  const s = getSettings().emailjs
  if (!s.publicKey)  throw new Error('EmailJS Public Key missing.')
  if (!s.serviceId)  throw new Error('EmailJS Service ID missing.')
  if (!s.templateId) throw new Error('EmailJS Template ID missing.')
  if (!opts.toEmail) throw new Error('No recipient email address provided.')

  // Build the public verify URL → /verify?code=CERT-XXXX-XXXX
  let viewUrl = ''
  const siteUrl = (getSettings().siteUrl || 'https://school-ecertify.web.app').replace(/\/$/, '')
  if (opts.certCode) {
    // Primary: use the cert code directly — no Firebase push needed
    viewUrl = `${siteUrl}/verify?code=${opts.certCode}`
    console.log('[Email] Certificate verify URL:', viewUrl)
  } else if (opts.certId && opts.imageDataUrl && isConnected()) {
    try {
      await pushCertShare(opts.certId, opts.imageDataUrl, opts.participantName)
      viewUrl = `${siteUrl}/verify?code=${opts.certId}`
      console.log('[Email] Certificate verify URL (fallback):', viewUrl)
    } catch (e) {
      console.warn('[Email] Could not push cert share to Firebase:', e.message || e)
    }
  }

  emailjs.init({ publicKey: s.publicKey })

  const templateParams = {
    email:            opts.toEmail,
    participant_name: opts.participantName || '',
    team_name:        opts.teamName        || '',
    school_name:      opts.schoolName      || '',
    subject:          'Pechacks 4.0 – High School Track Certificate',
    // This becomes the "View My Certificate" button href in the email template
    view_url:         viewUrl,
  }

  try {
    const response = await emailjs.send(s.serviceId, s.templateId, templateParams)
    return response
  } catch (err) {
    throw new Error(readError(err))
  }
}
