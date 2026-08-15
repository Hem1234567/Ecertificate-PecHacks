import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminLogin() {
  const { login, loggedIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in → redirect
  if (loggedIn) {
    navigate('/admin/dashboard', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Enter both email and password.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 400)) // slight delay for UX
    const ok = login(email, password)
    if (ok) {
      navigate('/admin/dashboard', { replace: true })
    } else {
      setError('Invalid email or password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `
        radial-gradient(900px 500px at 20% 20%, rgba(201,162,75,0.06), transparent 55%),
        radial-gradient(600px 400px at 80% 80%, rgba(111,184,172,0.05), transparent 50%)
      `,
      padding: 24,
    }}>
      {/* Back to landing */}
      <Link to="/" style={{
        position: 'absolute', top: 24, left: 32, fontSize: 13,
        color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
      }}>← Back to home</Link>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--surface)', border: '1px solid var(--border-soft)',
        borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px',
            background: 'radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold) 60%, var(--gold-dim) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, color: '#201703', fontSize: 20,
            boxShadow: '0 0 0 4px rgba(201,162,75,0.2)',
          }}>CG</div>
          <h1 style={{ fontSize: 22, margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Admin Portal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Sign in to access the certificate dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@certify.com"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="field-row">
            <label htmlFor="admin-pass">Password</label>
            <input
              id="admin-pass"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-soft)', border: '1px solid #5c3038',
              color: '#ff9d97', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, marginBottom: 16,
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold btn-block"
            style={{ marginTop: 8, fontSize: 15, padding: '12px 20px' }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-elev)', border: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 6, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>Default credentials</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Email: <code style={{ color: 'var(--gold-soft)' }}>admin@certify.com</code></div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>Password: <code style={{ color: 'var(--gold-soft)' }}>Admin@123</code></div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>Change these in Settings after logging in.</div>
        </div>
      </div>
    </div>
  )
}
