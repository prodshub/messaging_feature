import { useState } from 'react'

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderTop: '1px solid #eee',
      background: '#fff'
    }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a message..."
        style={{
          flex: 1, padding: '10px 14px',
          borderRadius: 20, border: '1px solid #ccc',
          outline: 'none', fontSize: 14
        }}
      />
      <button
        onClick={handleSend}
        style={{
          background: '#1a1a1a', color: '#fff',
          border: 'none', borderRadius: 8,
          padding: '10px 18px', cursor: 'pointer',
          fontWeight: 'bold', fontSize: 14
        }}
      >
        Send
      </button>
    </div>
  )
}