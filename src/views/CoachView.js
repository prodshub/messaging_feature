import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import ChatBubble from '../components/ChatBubble'
import MessageInput from '../components/MessageInput'

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444']
const avatarColor = (name) => {
  const i = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

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

function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now  = new Date()
  const diffMs   = now - date
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (diffMs < 7 * 24 * 3600 * 1000) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
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

export default function CoachView({ session }) {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastMessages, setLastMessages] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    const fetchClients = async () => {
      const { data: clientList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .eq('coach_id', session.user.id)

      setClients(clientList || [])
      setLoading(false)

      if (clientList && clientList.length > 0) {
        const previews = {}
        await Promise.all(
          clientList.map(async (client) => {
            const { data } = await supabase
              .from('messages')
              .select('message, created_at, sender_id, attachment_name, attachment_type')
              .or(
                `and(sender_id.eq.${session.user.id},receiver_id.eq.${client.user_id}),` +
                `and(sender_id.eq.${client.user_id},receiver_id.eq.${session.user.id})`
              )
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (data) previews[client.user_id] = data
          })
        )
        setLastMessages(previews)
      }
    }
    fetchClients()
  }, [session])

  useEffect(() => {
    if (!selectedClient) return
    setMessages([])

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

    const channel = supabase
      .channel(`coach-chat-${selectedClient.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${session.user.id}`,
      }, (payload) => {
        const msg = payload.new
        if (msg.sender_id === selectedClient.user_id) {
          setMessages((prev) => [...prev, msg])
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${session.user.id}`,
      }, (payload) => {
        setMessages((prev) =>
          prev.map((m) => m.id === payload.new.id ? payload.new : m)
        )
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [selectedClient, session])

  useEffect(() => {
    if (!selectedClient || messages.length === 0) return
    const unread = messages.filter(
      (m) => m.sender_id === selectedClient.user_id && !m.is_read
    )
    if (unread.length === 0) return
    const ids = unread.map((m) => m.id)
    supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids)
  }, [messages, selectedClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // attachmentMeta = { url, name, type, size } | null — provided by MessageInput after upload
  const sendMessage = async (text, attachmentMeta = null) => {
    if (!selectedClient) return false
    const row = {
      sender_id:   session.user.id,
      receiver_id: selectedClient.user_id,
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
    setLastMessages((prev) => ({ ...prev, [selectedClient.user_id]: data }))
    return true
  }

  const clientName = (c) => c.display_name || c.username || 'Client'

  // Sidebar preview text — show attachment hint if no text body
  const previewText = (last) => {
    if (!last) return 'No messages yet'
    const prefix = last.sender_id === session.user.id ? 'You: ' : ''
    if (last.message) return prefix + last.message
    if (last.attachment_type === 'image') return prefix + '📷 Image'
    if (last.attachment_type === 'pdf')   return prefix + '📄 PDF'
    if (last.attachment_type === 'doc')   return prefix + '📝 Document'
    return prefix + 'Attachment'
  }

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: 260, background: '#1a2332',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '20px 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>
                MoneyTact
              </div>
              <div style={{ fontSize: 11, color: '#5a6a80', marginTop: 2 }}>Coach Portal</div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none',
                borderRadius: 6, padding: '5px 10px',
                color: '#8896ab', fontSize: 11, cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div style={{
          fontSize: 10, fontWeight: 700, color: '#3d5066',
          padding: '8px 16px 6px', textTransform: 'uppercase', letterSpacing: '0.8px',
        }}>
          Clients
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ padding: '12px 16px', color: '#3d5066', fontSize: 13 }}>Loading...</p>
          )}
          {!loading && clients.length === 0 && (
            <p style={{ padding: '12px 16px', color: '#3d5066', fontSize: 13 }}>No clients assigned yet.</p>
          )}
          {clients.map((client) => {
            const isActive = selectedClient?.user_id === client.user_id
            const last  = lastMessages[client.user_id]
            const color = avatarColor(clientName(client))
            return (
              <div
                key={client.user_id}
                onClick={() => setSelectedClient(client)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0,
                }}>
                  {clientName(client).charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#fff' : '#c8d6e5' }}>
                      {clientName(client)}
                    </span>
                    {last && (
                      <span style={{ fontSize: 10, color: '#3d5066', flexShrink: 0, marginLeft: 4 }}>
                        {formatRelativeTime(last.created_at)}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#4a5d72',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1,
                  }}>
                    {previewText(last)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
        {!selectedClient ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column',
            background: '#f7f9fc',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, color: '#8896ab', fontWeight: 500 }}>
              Select a client to start messaging
            </div>
          </div>
        ) : (
          <>
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid #eef0f4',
              display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: avatarColor(clientName(selectedClient)),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff',
              }}>
                {clientName(selectedClient).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a2332' }}>
                  {clientName(selectedClient)}
                </div>
                <div style={{ fontSize: 11, color: '#8896ab', marginTop: 1 }}>Client</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f7f9fc' }}>
              {messages.length === 0 && (
                <p style={{ color: '#8896ab', textAlign: 'center', fontSize: 13 }}>
                  No messages yet. Start the conversation!
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
                    senderName={clientName(selectedClient)}
                    isGrouped={isGroupedWithPrev(messages, idx)}
                  />
                </Fragment>
              ))}
              <div ref={bottomRef} />
            </div>

            <MessageInput
              onSend={sendMessage}
              placeholder={`Message ${clientName(selectedClient)}...`}
            />
          </>
        )}
      </div>
    </div>
  )
}