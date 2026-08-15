import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-seal">CG</div>
        <div className="brand-text">
          <b>Certify</b>
          <span>Admin Dashboard</span>
        </div>
      </div>

      <nav className="nav">
        <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
          🏠 Dashboard
        </NavLink>
        <NavLink to="/admin/editor" className={({ isActive }) => isActive ? 'active' : ''}>
          ✏️ Template Editor
        </NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'active' : ''}>
          ⚙️ Settings
        </NavLink>
      </nav>

      <div className="sidebar-foot">
        <div style={{ marginBottom: 12 }}>
          Everything stays stored in this browser on this device. Nothing is uploaded anywhere unless Firebase sync is enabled.
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            background: 'var(--danger-soft)', border: '1px solid #5c3038',
            color: '#ff9d97', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}
