import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../api/userApi';
import { showAlert, showToast } from '../utils/Alert';
import { setToken, getTokenExpirySeconds } from '../utils/authUtility';
import { useWebSocket } from '../contexts/WebSocketContext';

// 네비게이션 딜레이 설정 (WebSocket 재연결 대기)
const NAVIGATE_DELAY_LOGIN = 100;

export default function Login() {
  const [id, setId] = useState('admin');
  const [password, setPassword] = useState('1234');
  const [keepLogin, setKeepLogin] = useState(false);
  const navigate = useNavigate();
  const { forceReconnect } = useWebSocket();

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await userApi.login(id, password, keepLogin);
      const { user, accessToken } = data;

      if (accessToken && user) {
        // authUtility를 통해 토큰 설정 (application.yml과 동기화)
        setToken(accessToken, getTokenExpirySeconds());
        localStorage.setItem('myId', user.id);
        
        showToast(`환영합니다, ${user.name}님!`, 'success');
        
        // WebSocket 강제 재연결 (토큰 변경 후)
        forceReconnect();
        
        // Dashboard 마운트 완료 후 네비게이트 (WebSocket 리스너 설정 대기)
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, NAVIGATE_DELAY_LOGIN);
      } else {
        throw new Error("로그인 응답 데이터 오류");
      }
    } catch (e) {
      console.error(e);
      let errorMessage = '로그인 중 오류가 발생했습니다.';

      if (axios.isAxiosError(e)) {
        if (e.response?.data && typeof e.response.data === 'string') {
          errorMessage = e.response.data;
        } else if (e.response?.status === 401) {
          errorMessage = '아이디 또는 비밀번호를 확인해주세요.';
        }
      } else if (e instanceof Error) {
        errorMessage = e.message;
      }

      showAlert('로그인 실패', errorMessage, 'error');
    }
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
