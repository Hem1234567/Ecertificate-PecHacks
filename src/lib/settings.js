/* lib/settings.js */
const KEY = 'certgen_settings_v1'
const defaults = {
  admin: {
    email: 'admin@certify.com',
    password: 'Admin@123',
  },
  emailjs: {
    publicKey: '3yHYsf92AtFPZ7IO6',
    serviceId: 'service_x3fcfi6',
    templateId: 'template_203c43v',
    fromName: '',
    subject: 'Your certificate from {{event}}',
    message: 'Hi {{name}},\n\nCongratulations! Please find your certificate for {{event}} attached.\n\nBest regards,\n{{from_name}}',
  },
  firebase: {
    enabled: true,
    apiKey: 'AIzaSyAa9HA-qsf-_vUZ-AU6W58CNbGNZrsAwKA',
    authDomain: 'school-ecertify.firebaseapp.com',
    projectId: 'school-ecertify',
    storageBucket: 'school-ecertify.firebasestorage.app',
    messagingSenderId: '575788063861',
    appId: '1:575788063861:web:89ee74ff9024fb9c9c2c3c',
  },
  siteUrl: 'https://school-ecertify.web.app',
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const adminMerged    = Object.assign({}, defaults.admin, parsed.admin)
    const emailMerged    = Object.assign({}, defaults.emailjs, parsed.emailjs)
    const firebaseMerged = Object.assign({}, defaults.firebase, parsed.firebase)

    // Hardcoded EmailJS + Firebase credentials always win
    emailMerged.publicKey         = defaults.emailjs.publicKey
    emailMerged.serviceId         = defaults.emailjs.serviceId
    emailMerged.templateId        = defaults.emailjs.templateId
    firebaseMerged.apiKey                = defaults.firebase.apiKey
    firebaseMerged.authDomain            = defaults.firebase.authDomain
    firebaseMerged.projectId             = defaults.firebase.projectId
    firebaseMerged.storageBucket         = defaults.firebase.storageBucket
    firebaseMerged.messagingSenderId     = defaults.firebase.messagingSenderId
    firebaseMerged.appId                 = defaults.firebase.appId
    firebaseMerged.enabled               = true

    return {
      admin: adminMerged,
      emailjs: emailMerged,
      firebase: firebaseMerged,
      siteUrl: parsed.siteUrl || defaults.siteUrl,
    }
  } catch {
    return JSON.parse(JSON.stringify(defaults))
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
  return settings
}

export function isEmailConfigured() {
  const s = getSettings().emailjs
  return !!(s.publicKey && s.serviceId && s.templateId)
}

export function isFirebaseConfigured() {
  const f = getSettings().firebase
  return !!(f.apiKey && f.authDomain && f.projectId && f.appId)
}
