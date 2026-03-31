import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'member', skills: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message)
      else navigate('/')
    } else {
      const skills = form.skills.split(',').map(s => s.trim()).filter(Boolean)
      const { error } = await signUp(form.email, form.password, form.name, form.role, skills)
      if (error) setError(error.message)
      else { setError(''); setMode('login'); setForm(f => ({ ...f, password: '' })) }
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-dot" />
          <span className="brand-name">NestUp</span>
          <span className="brand-tag">Work Management</span>
        </div>

        <h1 className="login-title">
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit} className="login-form">
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input name="name" value={form.name} onChange={handle} required placeholder="Your name" />
              </div>
              <div className="field">
                <label>Role</label>
                <select name="role" value={form.role} onChange={handle}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label>Skills <span className="field-hint">(comma separated)</span></label>
                <input name="skills" value={form.skills} onChange={handle} placeholder="React, Node, Python" />
              </div>
            </>
          )}

          <div className="field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handle} required placeholder="you@example.com" />
          </div>

          <div className="field">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handle} required placeholder="••••••••" />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="login-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }} className="link-btn">
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>

        <div className="demo-creds">
          <p>Demo credentials</p>
          <code>admin@nestup.com / admin123</code>
          <code>member@nestup.com / member123</code>
        </div>
      </div>
    </div>
  )
}
