import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { loggedIn } = useAuth()
  if (!loggedIn) return <Navigate to="/admin" replace />
  return children
}
