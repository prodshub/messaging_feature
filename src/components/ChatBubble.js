import { useState } from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Attachment renderers ─────────────────────────────────────────────────────

function ImageAttachment({ url, name, isMine }) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      {/* Thumbnail inside the bubble */}
      <div
        onClick={() => setLightbox(true)}
        title="Click to view full size"
        style={{
          marginBottom: 6, cursor: 'zoom-in',
          borderRadius: 6, overflow: 'hidden',
          // Sit above any text padding so it bleeds edge-to-edge inside the bubble
          marginLeft: -14, marginRight: -14, marginTop: -9,
          // Only add top-radius so corners match the parent bubble
          borderTopLeftRadius: 8, borderTopRightRadius: 8,
        }}
      >
        <img
          src={url}
          alt={name || 'attachment'}
          style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }}
        />
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={url}
            alt={name || 'attachment'}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 18,
              padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

function FileAttachment({ url, name, type, size, isMine }) {
  const icon = type === 'pdf' ? '📄' : '📝'
  const label = type === 'pdf' ? 'PDF' : 'Word Document'

  return (
    <a
      href={url}
      download={name}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        textDecoration: 'none',
        background: isMine ? 'rgba(255,255,255,0.15)' : '#f0f4ff',
        border: `1px solid ${isMine ? 'rgba(255,255,255,0.25)' : '#c7d8ff'}`,
        borderRadius: 8, padding: '8px 12px',
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 28, flexShrink: 0 }}>{icon}</span>

      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: isMine ? '#fff' : '#1a2332',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name || 'Attachment'}
        </div>
        <div style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : '#8896ab', marginTop: 1 }}>
          {label}{size ? ` · ${formatBytes(size)}` : ''}
        </div>
      </div>

      {/* Download icon */}
      <span style={{
        fontSize: 14, flexShrink: 0,
        color: isMine ? 'rgba(255,255,255,0.7)' : '#2563eb',
      }}>
        ⬇
      </span>
    </a>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ChatBubble({ message, isMine, senderName, isGrouped }) {
  const [expanded, setExpanded] = useState(false)

  const isEdited  = message.is_edited
  const content   = isEdited ? message.edited_message : message.message

  const hasAttachment = !!message.attachment_url
  const hasText       = content && content.length > 0

  const CHAR_LIMIT     = 300
  const isTruncatable  = hasText && content.length > CHAR_LIMIT
  const displayContent = isTruncatable && !expanded
    ? content.slice(0, CHAR_LIMIT).trimEnd()
    : content

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      marginBottom: isGrouped ? 4 : 14,
      flexDirection: isMine ? 'row-reverse' : 'row',
    }}>

      {/* Avatar / spacer */}
      {!isMine ? (
        isGrouped ? (
          <div style={{ width: 30, flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: '#4a5568',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2,
          }}>
            {senderName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )
      ) : null}

      <div style={{ maxWidth: '65%' }}>

        {/* Sender name */}
        {!isGrouped && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#8896ab', marginBottom: 4,
            textAlign: isMine ? 'right' : 'left',
          }}>
            {isMine ? 'You' : (senderName || 'Sender')}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding: '9px 14px', borderRadius: 8,
          fontSize: 13, lineHeight: 1.5,
          overflow: 'hidden',   // ensures image bleeds don't spill out
          ...(isMine
            ? { background: '#2563eb', color: '#fff' }
            : { background: '#fff', color: '#1a2332', border: '1px solid #e8ecf0' }
          ),
        }}>

          {/* ── Attachment ── */}
          {hasAttachment && message.attachment_type === 'image' && (
            <ImageAttachment
              url={message.attachment_url}
              name={message.attachment_name}
              isMine={isMine}
            />
          )}
          {hasAttachment && (message.attachment_type === 'pdf' || message.attachment_type === 'doc') && (
            <FileAttachment
              url={message.attachment_url}
              name={message.attachment_name}
              type={message.attachment_type}
              size={message.attachment_size}
              isMine={isMine}
            />
          )}

          {/* ── Text ── */}
          {hasText && (
            <>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {displayContent}
                {isTruncatable && !expanded && '...'}
              </span>
              {isTruncatable && (
                <span
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    display: 'block', marginTop: 6, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', userSelect: 'none',
                    color: isMine ? 'rgba(255,255,255,0.75)' : '#2563eb',
                  }}
                >
                  {expanded ? 'Show less ↑' : 'Show full message ↓'}
                </span>
              )}
            </>
          )}
        </div>

        {/* Timestamp + edited + read receipt */}
        <div style={{
          display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
          alignItems: 'center', gap: 4, marginTop: 4,
        }}>
          <small style={{ color: '#b0bac9', fontSize: 10 }}>
            {formatRelativeTime(message.created_at)}
            {isEdited && ' · edited'}
          </small>
          {isMine && (
            <small style={{ color: message.is_read ? '#2563eb' : '#b0bac9', fontSize: 10 }}>
              {message.is_read ? '✓✓' : '✓'}
            </small>
          )}
        </div>

      </div>
    </div>
  )
}