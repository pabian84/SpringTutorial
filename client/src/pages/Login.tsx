import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  // 개발용 기본값
  const [id, setId] = useState('admin');
  const [password, setPassword] = useState('1234');
  const [keepLogin, setKeepLogin] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  // 이미 인증되어 있으면 대시보드로
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(id, password, keepLogin);
  };

  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: 'var(--bg-color)',
    },
    card: {
      width: '400px',
      padding: '40px',
      borderRadius: '16px',
      backgroundColor: 'var(--card-color)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      textAlign: 'center' as const,
    },
    title: {
      fontSize: '32px',
      marginBottom: '30px',
      color: 'var(--text-color)',
    },
    label: {
      display: 'block',
      textAlign: 'left' as const,
      marginBottom: '8px',
      color: '#aaa',
      fontSize: '14px',
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome Back</h1>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Username</label>
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="아이디를 입력하세요"
            />
          </div>

          <div style={{ marginBottom: 30 }}>
            <label style={styles.label}>Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="비밀번호를 입력하세요"
            />
          </div>
          <div style={{ marginBottom: 20, textAlign: 'left', color: '#ccc' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={keepLogin}
                onChange={e => setKeepLogin(e.target.checked)}
                style={{ width: 'auto', marginRight: 10, marginBottom: 0 }}
              />
              로그인 상태 유지
            </label>
          </div>

          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
