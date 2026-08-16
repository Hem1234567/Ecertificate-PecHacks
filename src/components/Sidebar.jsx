import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/admin/editor',    icon: '✏️', label: 'Editor'    },
  { to: '/admin/settings',  icon: '⚙️', label: 'Settings'  },
  { to: '/verify',          icon: '🔍', label: 'Verify', external: true },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <>
      {/* ── Desktop / tablet sidebar ─────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-seal">CG</div>
          <div className="brand-text">
            <b>Certify</b>
            <span>Admin Dashboard</span>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map(({ to, icon, label, external }) => (
            <NavLink
              key={to}
              to={to}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div style={{ marginBottom: 12 }}>
            Everything stays stored in this browser on this device. Nothing is uploaded anywhere unless Firebase sync is enabled.
          </div>
          <button onClick={handleLogout} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav bar ────────────────────────────── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(({ to, icon, label, external }) => (
          <NavLink
            key={to}
            to={to}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="mobile-nav-icon">{icon}</span>
            <span className="mobile-nav-label">{label}</span>
          </NavLink>
        ))}
        <button onClick={handleLogout} className="mobile-nav-item mobile-nav-logout">
          <span className="mobile-nav-icon">🚪</span>
          <span className="mobile-nav-label">Logout</span>
        </button>
      </nav>
    </>
  )
}
