import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import MemberDashboard from './pages/MemberDashboard'
import DebugPage from './pages/DebugPage'
import { Spinner } from './components/UI'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="page-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  
  // Check if profile loaded
  if (!profile) {
    return (
      <div className="page-center">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Profile Not Found</h2>
          <p>Your account exists but profile data is missing.</p>
          <p>Please contact support or try logging out and back in.</p>
          <button onClick={() => window.location.href = '/login'} className="btn btn-primary">
            Back to Login
          </button>
        </div>
      </div>
    )
  }
  
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to="/" replace />
  }
  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="page-center"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  
  // Wait for profile to load before redirecting
  if (!profile) {
  return (
    <div className="page-center">
      <Spinner />
      <p style={{ marginTop: '1rem',color:'#666' }}>Preparing your dashboard...</p>
    </div>
  )
}
  
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/member'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/member" element={
            <ProtectedRoute requiredRole="member">
              <MemberDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
