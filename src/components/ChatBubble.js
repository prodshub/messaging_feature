export default function ChatBubble({ message, isMine }) {
  const isEdited = message.is_edited
  const content = isEdited ? message.edited_message : message.message

  return (
    <div style={{
      display: 'flex',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      alignItems: 'flex-end',
      gap: 8
    }}>
      {/* Avatar for other person */}
      {!isMine && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#ccc', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 'bold', color: '#fff',
          flexShrink: 0
        }}>
          C
        </div>
      )}

      <div style={{ maxWidth: '70%' }}>
        {/* Bubble */}
        <div style={{
          background: isMine ? '#1a1a1a' : '#f0f0f0',
          color: isMine ? '#fff' : '#000',
          padding: '10px 14px',
          borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{content}</p>
        </div>

        {/* Timestamp + read receipt + edited */}
        <div style={{
          display: 'flex',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          gap: 4,
          marginTop: 4
        }}>
          <small style={{ color: '#999', fontSize: 11 }}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isEdited && ' · edited'}
          </small>
          {isMine && (
            <small style={{ color: message.is_read ? '#0070f3' : '#999', fontSize: 11 }}>
              {message.is_read ? '✓✓' : '✓'}
            </small>
          )}
        </div>
      </div>
    </div>
  )
}