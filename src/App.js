import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import CoachLogin from './views/CoachLogin'
import ClientLogin from './views/ClientLogin'
import ClientView from './views/ClientView'
import CoachView from './views/CoachView'

function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setProfile(null)
    })
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    setProfile(data)
  }

  if (session === undefined || profile === undefined) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Coach route */}
        <Route
          path="/coach"
          element={
            !session
              ? <CoachLogin />
              : profile?.role === 'coach'
              ? <CoachView session={session} />
              : <div style={{ padding: 24, color: 'red' }}>⛔ Access denied. Not a coach account.</div>
          }
        />

        {/* Client route */}
        <Route
          path="/client"
          element={
            !session
              ? <ClientLogin />
              : profile?.role === 'client'
              ? <ClientView session={session} />
              : <div style={{ padding: 24, color: 'red' }}>⛔ Access denied. Not a client account.</div>
          }
        />

        <Route path="*" element={<Navigate to="/client" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App