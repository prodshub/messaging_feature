import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ChatBubble from '../components/ChatBubble'
import MessageInput from '../components/MessageInput'

export default function CoachView({ session }) {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  // Fetch only clients assigned to this coach
  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .eq('coach_id', session.user.id)
      setClients(data || [])
      setLoading(false)
    }
    fetchClients()
  }, [session])

  // Fetch messages when a client is selected
  useEffect(() => {
    if (!selectedClient) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${session.user.id},receiver_id.eq.${selectedClient.user_id}),` +
          `and(sender_id.eq.${selectedClient.user_id},receiver_id.eq.${session.user.id})`
        )
        .order('created_at', { ascending: true })
      setMessages(data || [])
    }

    fetchMessages()

    // Realtime subscription
    const channel = supabase
      .channel(`coach-chat-${selectedClient.user_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new
            const isRelevant =
              (msg.sender_id === session.user.id && msg.receiver_id === selectedClient.user_id) ||
              (msg.sender_id === selectedClient.user_id && msg.receiver_id === session.user.id)
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
  }, [selectedClient, session])

  // Mark messages as read
  useEffect(() => {
    if (!selectedClient || messages.length === 0) return
    const unread = messages.filter(
      (m) => m.sender_id === selectedClient.user_id && !m.is_read
    )
    if (unread.length === 0) return
    const ids = unread.map((m) => m.id)
    supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
  }, [messages, selectedClient])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!selectedClient) return
    await supabase.from('messages').insert({
      sender_id: session.user.id,
      receiver_id: selectedClient.user_id,
      message: text,
    })
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'sans-serif',
      background: '#f5f5f5'
    }}>

      {/* Left sidebar — client list */}
      <div style={{
        width: 280,
        background: '#fff',
        borderRight: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>My Clients</span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Client list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ padding: 16, color: '#999' }}>Loading clients...</p>
          )}
          {!loading && clients.length === 0 && (
            <p style={{ padding: 16, color: '#999' }}>No clients assigned yet.</p>
          )}
          {clients.map((client) => (
            <div
              key={client.user_id}
              onClick={() => setSelectedClient(client)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedClient?.user_id === client.user_id ? '#f0f4ff' : '#fff',
                borderLeft: selectedClient?.user_id === client.user_id
                  ? '3px solid #1a1a1a'
                  : '3px solid transparent',
                borderBottom: '1px solid #f5f5f5'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#1a1a1a', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 'bold', fontSize: 16,
                flexShrink: 0
              }}>
                {client.display_name?.charAt(0) || client.username?.charAt(0) || '?'}
              </div>

              {/* Name */}
              <div style={{ overflow: 'hidden' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>
                  {client.display_name || client.username || 'Client'}
                </p>
                <p style={{
                  margin: 0, fontSize: 12, color: '#999',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  Click to open chat
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — chat */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff'
      }}>
        {!selectedClient ? (
          <div style={{
            flex: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', color: '#999'
          }}>
            <p style={{ fontSize: 40 }}>💬</p>
            <p style={{ fontSize: 16 }}>Select a client to start messaging</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#fff'
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#1a1a1a', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 'bold', fontSize: 16
              }}>
                {selectedClient.display_name?.charAt(0) || '?'}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 15 }}>
                  {selectedClient.display_name || selectedClient.username || 'Client'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>Client</p>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '16px 20px',
              background: '#fafafa'
            }}>
              {messages.length === 0 && (
                <p style={{ color: '#999', textAlign: 'center' }}>
                  No messages yet. Start the conversation!
                </p>
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

            {/* Input */}
            <MessageInput onSend={sendMessage} />
          </>
        )}
      </div>
    </div>
  )
}