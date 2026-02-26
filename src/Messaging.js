import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function Messaging({ session }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [profiles, setProfiles] = useState([])
  const bottomRef = useRef(null)

  // Fetch all users to select a recipient
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', session.user.id)
      setProfiles(data || [])
    }
    fetchProfiles()
  }, [session])

  // Fetch messages between current user and selected recipient
  useEffect(() => {
    if (!receiverId) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${session.user.id},receiver_id.eq.${receiverId}),` +
          `and(sender_id.eq.${receiverId},receiver_id.eq.${session.user.id})`
        )
        .order('created_at', { ascending: true })
      setMessages(data || [])
    }

    fetchMessages()

    // ---- REALTIME WEBSOCKET SUBSCRIPTION ----
    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new
          // Only add if relevant to this conversation
          const isRelevant =
            (msg.sender_id === session.user.id && msg.receiver_id === receiverId) ||
            (msg.sender_id === receiverId && msg.receiver_id === session.user.id)
          if (isRelevant) {
            setMessages((prev) => [...prev, msg])
          }
        }
      )
      .subscribe()

    // Cleanup subscription on conversation switch
    return () => supabase.removeChannel(channel)
  }, [receiverId, session])

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read
  useEffect(() => {
    if (!receiverId || messages.length === 0) return
    const unread = messages.filter(
      (m) => m.receiver_id === session.user.id && !m.is_read
    )
    if (unread.length === 0) return

    const ids = unread.map((m) => m.id)
    supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
  }, [messages, receiverId, session])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !receiverId) return

    await supabase.from('messages').insert({
      sender_id: session.user.id,
      receiver_id: receiverId,
      message: newMessage.trim(),
    })

    setNewMessage('')
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>Messages</h2>

      {/* Select recipient */}
      <div style={{ marginBottom: 16 }}>
        <label>Send to: </label>
        <select onChange={(e) => setReceiverId(e.target.value)} value={receiverId}>
          <option value=''>-- Select a user --</option>
          {profiles.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.username}
            </option>
          ))}
        </select>
      </div>

      {/* Message thread */}
      <div style={{ border: '1px solid #ccc', height: 400, overflowY: 'scroll', padding: 12, marginBottom: 12, borderRadius: 8 }}>
        {messages.length === 0 && <p style={{ color: '#999' }}>No messages yet.</p>}
        {messages.map((msg) => {
          const isMine = msg.sender_id === session.user.id
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  background: isMine ? '#0070f3' : '#f0f0f0',
                  color: isMine ? '#fff' : '#000',
                  padding: '8px 12px',
                  borderRadius: 12,
                  maxWidth: '70%',
                }}
              >
                <p style={{ margin: 0 }}>{msg.is_edited ? msg.edited_message : msg.message}</p>
                <small style={{ opacity: 0.7, fontSize: 10 }}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                  {msg.is_edited && ' · edited'}
                  {isMine && msg.is_read && ' · ✓ read'}
                </small>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder='Type a message...'
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
        />
        <button type='submit' style={{ padding: '8px 16px', borderRadius: 8 }}>
          Send
        </button>
      </form>
    </div>
  )
}