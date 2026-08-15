import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Sidebar from './components/Sidebar.jsx'

import Landing from './pages/Landing.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Editor from './pages/Editor.jsx'
import Settings from './pages/Settings.jsx'
import ViewCertificate from './pages/ViewCertificate.jsx'

/* Admin shell: sidebar + content area */
function AdminShell({ children }) {
  return (
    <div className="shell">
      <Sidebar />
      <div style={{ overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/" element={<Landing />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/view-certificate" element={<ViewCertificate />} />

          {/* ── Protected admin routes ── */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute>
              <AdminShell><Dashboard /></AdminShell>
            </ProtectedRoute>
          } />
          <Route path="/admin/editor" element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute>
              <AdminShell><Settings /></AdminShell>
            </ProtectedRoute>
          } />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
