import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../api/userApi';
import { showAlert, showToast } from '../utils/Alert';

export default function Login() {
  const [id, setId] = useState('admin');
  const [password, setPassword] = useState('1234');
  // 로그인 유지 체크박스 상태
  const [keepLogin, setKeepLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 깔끔하게 비우고 시작해야 꼬이지 않습니다.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('myId');
  }, []);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // form submit 시 페이지 새로고침 방지
    try {
      // axios 직접 호출 제거
      const data = await userApi.login(id, password, keepLogin);
      const { user, accessToken } = data;

      // 토큰과 유저 정보가 있으면 성공 처리
      if (accessToken && user) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('myId', user.id);
        
        showToast(`환영합니다, ${user.name}님!`, 'success');
        navigate('/dashboard');
      } else {
        // 혹시라도 데이터가 비어있다면 에러 처리
        throw new Error("로그인 응답 데이터 오류");
      }
    } catch (e) {
      console.error(e);
      let errorMessage = '로그인 중 오류가 발생했습니다.';

      if (axios.isAxiosError(e)) {
        // 서버가 보낸 에러 메시지가 있다면 사용 (e.response.data가 string이라고 가정)
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