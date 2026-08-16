import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { loggedIn, authReady } = useAuth()

  // Wait for Firebase Auth to resolve before making a redirect decision.
  // Without this, the app would redirect to /admin on every refresh
  // before Firebase has a chance to restore the session.
  if (!authReady) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 16,
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, var(--gold-soft), var(--gold) 60%, var(--gold-dim) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, color: '#201703', fontSize: 18,
          animation: 'pulse 1.6s ease-in-out infinite',
        }}>CG</div>
        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.94)}}`}</style>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Loading…</p>
      </div>
    )
  }

  if (!loggedIn) return <Navigate to="/admin" replace />
  return children
}
