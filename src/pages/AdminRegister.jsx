import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminRegister() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('All fields are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 350))
    const result = register(name, email, password)
    if (result.ok) {
      navigate('/admin', { state: { registered: true } })
    } else {
      setError(result.error)
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
      {/* Back */}
      <Link to="/admin" style={{
        position: 'absolute', top: 24, left: 32, fontSize: 13,
        color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
      }}>← Back to login</Link>

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
          <h1 style={{ fontSize: 22, margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Create Account</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Register a new admin account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
          </div>

          <div className="field-row">
            <label htmlFor="reg-email">Email address</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
            />
          </div>

          <div className="field-row">
            <label htmlFor="reg-pass">Password</label>
            <input
              id="reg-pass"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="field-row">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
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
            {loading ? 'Creating account…' : '✨ Register Now'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-dim)' }}>
          Already have an account?{' '}
          <Link to="/admin" style={{ color: 'var(--gold-soft)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
