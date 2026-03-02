import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import ChatBubble from '../components/ChatBubble'
import MessageInput from '../components/MessageInput'

function isSameDay(d1, d2) {
  return new Date(d1).toDateString() === new Date(d2).toDateString()
}

function formatDateLabel(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (now - date < 7 * 24 * 3600 * 1000) return date.toLocaleDateString([], { weekday: 'long' })
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function isGroupedWithPrev(messages, idx) {
  if (idx === 0) return false
  const prev = messages[idx - 1]
  const curr = messages[idx]
  if (prev.sender_id !== curr.sender_id) return false
  return new Date(curr.created_at) - new Date(prev.created_at) < 5 * 60 * 1000
}

function DateSeparator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 12px', gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
      <span style={{ fontSize: 11, color: '#b0bac9', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
    </div>
  )
}

export default function ClientView({ session }) {
  const [messages, setMessages] = useState([])
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    const fetchCoach = async () => {
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

      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', clientProfile.coach_id)
        .single()

      setCoach(coachProfile)
    }

    fetchCoach()
  }, [session])

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

    const channel = supabase
      .channel(`client-chat-${session.user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${session.user.id}`,
      }, (payload) => {
        const msg = payload.new
        if (msg.sender_id === coach.user_id) setMessages((prev) => [...prev, msg])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${session.user.id}`,
      }, (payload) => {
        setMessages((prev) => prev.map((m) => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coach, session])

  useEffect(() => {
    if (!coach || messages.length === 0) return
    const unread = messages.filter((m) => m.sender_id === coach.user_id && !m.is_read)
    if (unread.length === 0) return
    supabase.from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unread.map((m) => m.id))
  }, [messages, coach])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // attachmentMeta = { url, name, type, size } | null — provided by MessageInput after upload
  const sendMessage = async (text, attachmentMeta = null) => {
    if (!coach) return false
    const row = {
      sender_id:   session.user.id,
      receiver_id: coach.user_id,
      message:     text || null,
      ...(attachmentMeta && {
        attachment_url:  attachmentMeta.url,
        attachment_name: attachmentMeta.name,
        attachment_type: attachmentMeta.type,
        attachment_size: attachmentMeta.size,
      }),
    }
    const { data, error } = await supabase
      .from('messages')
      .insert(row)
      .select()
      .single()
    if (error) { console.error('Send failed:', error.message); return false }
    setMessages((prev) => [...prev, data])
    return true
  }

  const coachName = coach?.display_name || 'Your Coach'

  if (!loading && !coach) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: '#f7f9fc',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 15, color: '#8896ab', fontWeight: 500 }}>
          You have not been assigned a coach yet.
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop: 16, padding: '8px 20px', borderRadius: 8,
            background: '#1a2332', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', maxWidth: 560, margin: '0 auto',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 18px', background: '#1a2332',
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.3px' }}>
          MoneyTact
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: 6, padding: '5px 12px',
            color: '#8896ab', fontSize: 11, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{
        padding: '16px 18px', borderBottom: '1px solid #eef0f4',
        display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: '#2563eb', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 18,
        }}>
          {coachName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2332' }}>{coachName}</div>
          <div style={{ fontSize: 12, color: '#8896ab', marginTop: 2 }}>
            {coach?.title || 'Financial Expert'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', background: '#f7f9fc' }}>
        {loading && (
          <p style={{ color: '#8896ab', textAlign: 'center', fontSize: 13 }}>Loading messages...</p>
        )}
        {!loading && messages.length === 0 && (
          <p style={{ color: '#8896ab', textAlign: 'center', fontSize: 13 }}>
            No messages yet. Say hi to your coach!
          </p>
        )}
        {messages.map((msg, idx) => (
          <Fragment key={msg.id}>
            {(idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at)) && (
              <DateSeparator label={formatDateLabel(msg.created_at)} />
            )}
            <ChatBubble
              message={msg}
              isMine={msg.sender_id === session.user.id}
              senderName={coachName}
              isGrouped={isGroupedWithPrev(messages, idx)}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} placeholder={`Message ${coachName}...`} />
    </div>
  )
}