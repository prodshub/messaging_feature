import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

// ── Constants ────────────────────────────────────────────────────────────────

const CHAR_LIMIT = 2000

// Accepted MIME types → bucket of allowed extensions shown in the picker
const ACCEPTED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Per-type size limits (bytes)
const SIZE_LIMITS = {
  image: 5  * 1024 * 1024,   //  5 MB
  pdf:   10 * 1024 * 1024,   // 10 MB
  doc:   10 * 1024 * 1024,   // 10 MB
}

function getMimeCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'doc'
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ────────────────────────────────────────────────────────────────

// MessageInput handles its own sending state and error display.
// onSend(text, attachmentMeta) is an async function from the parent.
//   attachmentMeta = { url, name, type, size } | null
// Returns true on success, false on failure.

export default function MessageInput({ onSend, placeholder }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // Pending attachment state
  const [pendingFile, setPendingFile]       = useState(null)   // File object
  const [previewUrl, setPreviewUrl]         = useState(null)   // object URL for image preview
  const [fileCategory, setFileCategory]     = useState(null)   // 'image' | 'pdf' | 'doc'
  const [fileError, setFileError]           = useState(null)

  const fileInputRef = useRef(null)

  // ── Character counter ──────────────────────────────────────────────────────
  const charsUsed  = text.length
  const charsLeft  = CHAR_LIMIT - charsUsed
  const showCounter = charsUsed >= 1500
  const counterColor = charsLeft <= 50 ? '#e53e3e' : charsLeft <= 200 ? '#f59e0b' : '#b0bac9'
  const overLimit  = charsUsed > CHAR_LIMIT

  // A message is sendable if it has text OR a valid attachment (or both)
  const canSend = !sending && !overLimit && !fileError && (text.trim() || pendingFile)

  // ── File selection ─────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    // Reset so the same file can be re-selected after cancellation
    e.target.value = ''
    if (!file) return

    // MIME check
    if (!ACCEPTED_MIME.includes(file.type)) {
      setFileError('Unsupported file type. Please attach an image, PDF, or Word document.')
      return
    }

    const category = getMimeCategory(file.type)

    // Size check
    if (file.size > SIZE_LIMITS[category]) {
      const limitLabel = formatBytes(SIZE_LIMITS[category])
      setFileError(`${category === 'image' ? 'Images' : category.toUpperCase() + 's'} must be under ${limitLabel}.`)
      return
    }

    setFileError(null)
    setFileCategory(category)
    setPendingFile(file)

    if (category === 'image') {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  const clearAttachment = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
    setFileCategory(null)
    setFileError(null)
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!canSend) return

    setSending(true)
    setError(null)

    let attachmentMeta = null

    // 1. Upload file if one is attached
    if (pendingFile) {
      const ext      = pendingFile.name.split('.').pop()
      const path     = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false })

      if (uploadError) {
        setError('File upload failed. Please try again.')
        setSending(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(uploadData.path)

      attachmentMeta = {
        url:  publicUrl,
        name: pendingFile.name,
        type: fileCategory,
        size: pendingFile.size,
      }
    }

    // 2. Delegate message insert to parent
    const success = await onSend(text.trim(), attachmentMeta)

    setSending(false)

    if (success) {
      setText('')
      clearAttachment()
    } else {
      setError('Message could not be sent. Please try again.')
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: '12px 18px 20px',
      borderTop: '1px solid #eef0f4',
      background: '#fff',
    }}>

      {/* Send error */}
      {error && (
        <p style={{ color: '#e53e3e', fontSize: 12, margin: '0 0 8px 0' }}>
          ⚠️ {error}
        </p>
      )}

      {/* File validation error */}
      {fileError && (
        <p style={{ color: '#e53e3e', fontSize: 12, margin: '0 0 8px 0' }}>
          ⚠️ {fileError}
        </p>
      )}

      {/* Attachment preview badge */}
      {pendingFile && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#f0f4ff', border: '1px solid #c7d8ff',
          borderRadius: 8, padding: '6px 10px',
          marginBottom: 8, maxWidth: '100%',
        }}>
          {/* Image thumbnail OR file icon */}
          {fileCategory === 'image' && previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <span style={{ fontSize: 22, flexShrink: 0 }}>
              {fileCategory === 'pdf' ? '📄' : '📝'}
            </span>
          )}

          {/* Name + size */}
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#1a2332',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>
              {pendingFile.name}
            </div>
            <div style={{ fontSize: 10, color: '#8896ab' }}>
              {formatBytes(pendingFile.size)}
            </div>
          </div>

          {/* Cancel */}
          <button
            onClick={clearAttachment}
            title="Remove attachment"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8896ab', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach file"
          style={{
            background: 'none', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
            fontSize: 18, color: '#8896ab', padding: 4, flexShrink: 0,
            opacity: sending ? 0.5 : 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { if (!sending) e.currentTarget.style.color = '#2563eb' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8896ab' }}
        >
          📎
        </button>

        {/* Text input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null) }}
            onKeyDown={handleKey}
            placeholder={placeholder || 'Type a message...'}
            disabled={sending}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 16px', borderRadius: 8,
              border: overLimit ? '1px solid #e53e3e' : '1px solid #dde3ec',
              outline: 'none', fontSize: 13,
              background: sending ? '#f5f7fa' : '#f7f9fc',
              color: '#1a2332', transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = overLimit ? '#e53e3e' : '#2563eb'}
            onBlur={(e)  => e.target.style.borderColor = overLimit ? '#e53e3e' : '#dde3ec'}
          />
          {showCounter && (
            <span style={{
              position: 'absolute', bottom: -18, right: 4,
              fontSize: 10, fontWeight: 600, color: counterColor,
            }}>
              {charsLeft < 0 ? `${Math.abs(charsLeft)} over limit` : `${charsLeft} left`}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            background: canSend ? '#2563eb' : '#94afd4',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', cursor: canSend ? 'pointer' : 'not-allowed',
            fontWeight: 600, fontSize: 13, transition: 'background 0.2s',
            minWidth: 90, whiteSpace: 'nowrap', alignSelf: 'flex-start',
          }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}