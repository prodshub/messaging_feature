import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ClientLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }

      if (data.user) {
        await supabase
          .from('profiles')
        .upsert({
        user_id: data.user.id,
        role: 'client',
        display_name: displayName || email,
          })
          .eq('user_id', data.user.id)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24, border: '1px solid #eee', borderRadius: 12 }}>
      <h2 style={{ textAlign: 'center' }}>Financial Literacy App</h2>
      <p style={{ textAlign: 'center', color: '#666' }}>Chat with your coach</p>
      <form onSubmit={handleAuth}>
        {isSignUp && (
          <input
            placeholder="Your Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={{ color: 'red', fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      <button onClick={() => setIsSignUp(!isSignUp)} style={linkStyle}>
        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
      </button>
    </div>
  )
}

const inputStyle = { display: 'block', width: '100%', marginBottom: 10, padding: 10, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }
const buttonStyle = { width: '100%', padding: 10, borderRadius: 8, background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }
const linkStyle = { marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a', display: 'block', textAlign: 'center' }