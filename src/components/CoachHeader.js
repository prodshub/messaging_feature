import { useNavigate } from 'react-router-dom'

export default function CoachHeader({ coach, onBack }) {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: '1px solid #eee',
      background: '#fff'
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ background: 'none', border: '1px solid #ccc', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', marginRight: 4 }}
        >
          ‹ Back
        </button>
      )}

      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: '#1a1a1a', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 'bold', fontSize: 18,
        flexShrink: 0
      }}>
        {coach?.display_name?.charAt(0) || 'C'}
      </div>

      {/* Name + title */}
      <div>
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: 15 }}>
          {coach?.display_name || 'Your Coach'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
          {coach?.title || 'Financial Expert'}
        </p>
      </div>
    </div>
  )
}