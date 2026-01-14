import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { showAlert, showToast } from '../utils/alert';

export default function Login() {
  const [id, setId] = useState('admin');
  const [password, setPassword] = useState('1234');
  // 로그인 유지 체크박스 상태
  const [keepLogin, setKeepLogin] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // form submit 시 페이지 새로고침 방지
    try {
      const res = await axios.post('/api/user/login', {
        id, password, isRememberMe: keepLogin
      });
      
      const { status, message, user, accessToken } = res.data;

      if (status === 'ok') {
        // [수정] AccessToken은 무조건 localStorage에 저장 (sessionStorage 안 씀)
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('myId', user.id);
        
        // 성공 시 가볍게 토스트 알림을 띄우고 이동
        showToast(`환영합니다, ${res.data.user.name}님!`, 'success');
        navigate('/dashboard');
      } else {
        // [변경] 실패 시 모달 창 띄우기
        showAlert('로그인 실패', message, 'error');
      }
    } catch (e) {
      console.error(e);
      // [변경] 서버 에러
      showAlert('오류 발생', '로그인 중 문제가 발생했습니다.', 'error');
    }
  };

  // 스타일 객체 (이 파일에서만 쓸 배치용 스타일)
  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh', // 화면 전체 높이
      backgroundColor: 'var(--bg-color)',
    },
    card: {
      width: '400px',
      padding: '40px',
      borderRadius: '16px',
      backgroundColor: 'var(--card-color)',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)', // 그림자 효과
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