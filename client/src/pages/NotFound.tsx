import { useNavigate } from 'react-router-dom';
import { FaHome, FaExclamationTriangle } from 'react-icons/fa';

export default function NotFound() {
  const navigate = useNavigate();

  const styles: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-color, #0f172a)',
    },
    card: {
      width: '400px',
      padding: '40px',
      borderRadius: '16px',
      backgroundColor: 'var(--card-color, #1e293b)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      textAlign: 'center',
    },
    iconContainer: {
      marginBottom: '20px',
    },
    icon: {
      color: '#f59e0b',
    },
    code: {
      fontSize: '72px',
      fontWeight: 'bold',
      color: 'var(--text-color, #f1f5f9)',
      margin: '0 0 10px 0',
      lineHeight: 1,
    },
    message: {
      fontSize: '18px',
      color: '#94a3b8',
      marginBottom: '30px',
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: '100%',
      padding: '14px 24px',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: 'none',
      backgroundColor: '#3b82f6',
      color: 'white',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <FaExclamationTriangle size={48} style={styles.icon} />
        </div>
        
        <h1 style={styles.code}>404</h1>
        <p style={styles.message}>페이지를 찾을 수 없습니다.</p>
        
        <button
          style={styles.button}
          onClick={() => navigate('/dashboard', { replace: true })}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          <FaHome size={16} />
          대시보드로 이동
        </button>
      </div>
    </div>
  );
}
