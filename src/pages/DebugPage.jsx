import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export default function DebugPage() {
  const { user, profile, loading } = useAuth()
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔍 Debug Info</h1>
      
      <div style={{ background: '#f5f5f5', padding: '1rem', margin: '1rem 0', borderRadius: '8px' }}>
        <h2>Auth Status</h2>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>User: {user ? '✅ Logged in' : '❌ Not logged in'}</p>
        {user && <p>Email: {user.email}</p>}
        {user && <p>Confirmed: {user.email_confirmed_at ? '✅' : '❌'}</p>}
      </div>

      <div style={{ background: '#f5f5f5', padding: '1rem', margin: '1rem 0', borderRadius: '8px' }}>
        <h2>Profile</h2>
        {profile ? (
          <>
            <p>✅ Profile loaded</p>
            <p>Name: {profile.name}</p>
            <p>Role: {profile.role}</p>
          </>
        ) : (
          <p>❌ Profile missing - THIS CAUSES BLACK SCREEN!</p>
        )}
      </div>

      <div style={{ background: '#fff3cd', padding: '1rem', margin: '1rem 0', borderRadius: '8px' }}>
        <h2>Fix</h2>
        {!user && <p>Go to <a href="/login">/login</a></p>}
        {user && !profile && <p>Run fix_users.sql in Supabase</p>}
        {user && profile && <p>✅ All good! <a href={profile.role === 'admin' ? '/admin' : '/member'}>Go to dashboard</a></p>}
      </div>
    </div>
  )
}
