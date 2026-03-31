function Loader({ message = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px'
    }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(76, 201, 240, 0.2)',
        borderTop: '4px solid var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{
        marginTop: '16px',
        color: 'var(--muted)',
        fontSize: '1rem'
      }}>
        {message}
      </p>
    </div>
  )
}

export default Loader
