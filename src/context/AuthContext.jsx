import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    console.log("Profile missing, creating...")

    // ✅ Auto-create profile if missing
    const { data: userData } = await supabase.auth.getUser()

    const newProfile = {
      id: userId,
      email: userData.user.email,
      name: userData.user.user_metadata?.name || "User",
      role: userData.user.user_metadata?.role || "member",
      skills: userData.user.user_metadata?.skills || []
    }

    const { error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)

    if (insertError) {
      console.log("Profile creation failed:", insertError)
      setProfile(null)
    } else {
      setProfile(newProfile)
    }
  } else {
    setProfile(data)
  }

  setLoading(false)
}

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, name, role, skills) {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { name, role, skills }
    }
  })

  if (error) return { error }

  // ✅ ALWAYS create profile (even if no session)
  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      role,
      skills
    })
    if (profileError) return { error: profileError }
  }

  return { error: null }
}
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
