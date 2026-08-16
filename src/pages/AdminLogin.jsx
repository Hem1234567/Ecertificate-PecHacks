import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminLogin() {
  const { login, loggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [lockSecs, setLockSecs] = useState(0)
  const justRegistered = location.state?.registered === true

  // Already logged in → redirect
  if (loggedIn) {
    navigate('/admin/dashboard', { replace: true })
    return null
  }

  // Countdown timer for lockout
  useEffect(() => {
    if (lockSecs <= 0) return
    const id = setInterval(() => {
      setLockSecs(s => {
        if (s <= 1) { clearInterval(id); setError(''); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [lockSecs])

  async function handleSubmit(e) {
    e.preventDefault()
    if (lockSecs > 0) return
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.ok) {
      navigate('/admin/dashboard', { replace: true })
    } else if (result.lockedUntil) {
      setLockSecs(result.secsLeft)
      setError(`Too many failed attempts. Try again in ${result.secsLeft}s.`)
    } else {
      const left = result.attemptsLeft
      setError(
        left !== undefined
          ? `Invalid credentials. ${left} attempt${left !== 1 ? 's' : ''} remaining before lockout.`
          : 'Invalid email or password. Please try again.'
      )
    }
    setLoading(false)
  }

  const fmtSecs = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="login-page">
      {/* Back link */}
      <Link to="/" className="login-back">← Back to home</Link>

      {/* Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-seal">CG</div>
          <h1 className="login-title">Admin Portal</h1>
          <p className="login-subtitle">Sign in to access the certificate dashboard</p>
        </div>

        {/* Success banner after registration */}
        {justRegistered && (
          <div className="login-banner login-banner--success">
            ✅ Account created! Sign in with your new credentials.
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="field-row">
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter admin email"
              autoComplete="username"
              autoFocus
              disabled={lockSecs > 0}
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
              disabled={lockSecs > 0}
            />
          </div>

          {error && (
            <div className={`login-banner ${lockSecs > 0 ? 'login-banner--lockout' : 'login-banner--error'}`}>
              {lockSecs > 0
                ? `🔒 Account locked. Try again in ${fmtSecs(lockSecs)}`
                : `⚠ ${error}`}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold btn-block login-submit"
            disabled={loading || lockSecs > 0}
          >
            {loading ? 'Signing in…' : lockSecs > 0 ? `Locked (${fmtSecs(lockSecs)})` : '🔐 Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
