import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ChatBubble from '../components/ChatBubble'
import MessageInput from '../components/MessageInput'

export default function ClientView({ session }) {
  const [messages, setMessages] = useState([])
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  // Fetch assigned coach from client's profile
  useEffect(() => {
    const fetchCoach = async () => {
      // Get client's own profile to find coach_id
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('coach_id')
        .eq('user_id', session.user.id)
        .single()

      if (!clientProfile?.coach_id) {
        setCoach(null)
        setLoading(false)
        return
      }

      // Fetch the coach's profile
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', clientProfile.coach_id)
        .single()

      setCoach(coachProfile)
    }

    fetchCoach()
  }, [session])

  // Fetch messages + realtime subscription
  useEffect(() => {
    if (!coach) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${session.user.id},receiver_id.eq.${coach.user_id}),` +
          `and(sender_id.eq.${coach.user_id},receiver_id.eq.${session.user.id})`
        )
        .order('created_at', { ascending: true })
      setMessages(data || [])
      setLoading(false)
    }

    fetchMessages()

    // Realtime subscription
    const channel = supabase
      .channel(`client-chat-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new
            const isRelevant =
              (msg.sender_id === session.user.id && msg.receiver_id === coach.user_id) ||
              (msg.sender_id === coach.user_id && msg.receiver_id === session.user.id)
            if (isRelevant) setMessages((prev) => [...prev, msg])
          }
          if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => m.id === payload.new.id ? payload.new : m)
            )
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coach, session])

  // Mark incoming messages as read
  useEffect(() => {
    if (!coach || messages.length === 0) return
    const unread = messages.filter(
      (m) => m.sender_id === coach.user_id && !m.is_read
    )
    if (unread.length === 0) return
    const ids = unread.map((m) => m.id)
    supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
  }, [messages, coach])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!coach) return
    await supabase.from('messages').insert({
      sender_id: session.user.id,
      receiver_id: coach.user_id,
      message: text,
    })
  }

  // No coach assigned yet
  if (!loading && !coach) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        flexDirection: 'column', fontFamily: 'sans-serif', color: '#999'
      }}>
        <p style={{ fontSize: 40 }}>⏳</p>
        <p style={{ fontSize: 16 }}>You have not been assigned a coach yet.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxWidth: 480,
      margin: '0 auto',
      background: '#fff',
      fontFamily: 'sans-serif'
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: '1px solid #eee',
        background: '#fff'
      }}>
        <span style={{ fontWeight: 'bold', fontSize: 15 }}>Financial Literacy App</span>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'none', border: '1px solid #ccc',
            borderRadius: 8, padding: '4px 12px',
            cursor: 'pointer', fontSize: 13
          }}
        >
          Account
        </button>
      </div>

      {/* Coach header */}
      <div style={{
        padding: '16px',
        textAlign: 'center',
        borderBottom: '1px solid #eee'
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#1a1a1a', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 'bold', fontSize: 22,
          margin: '0 auto 8px'
        }}>
          {coach?.display_name?.charAt(0) || 'C'}
        </div>
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: 16 }}>
          {coach?.display_name || 'Your Coach'}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
          {coach?.title || 'Financial Expert'}
        </p>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        background: '#fafafa'
      }}>
        {loading && (
          <p style={{ color: '#999', textAlign: 'center' }}>Loading messages...</p>
        )}
        {!loading && messages.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center' }}>No messages yet. Say hi!</p>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isMine={msg.sender_id === session.user.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <MessageInput onSend={sendMessage} />
    </div>
  )
}