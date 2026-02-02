import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../../api/sessionApi';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isValid, setIsValid] = useState<boolean | null>(null); // null: 검사 중

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsValid(false);
        navigate('/', { replace: true });
        return;
      }

      try {
        // 백엔드에 "이 토큰 살아있냐?" 하고 물어보는 가벼운 API 호출
        // (없으면 /api/users/me 같은 내 정보 조회 API 사용)
        await sessionApi.getMySessions();
        setIsValid(true);
      } catch (e) {
        // 검증 실패 -> 토큰 삭제 후 로그인으로 추방
        localStorage.removeItem('accessToken');
        localStorage.removeItem('myId');
        setIsValid(false);
        console.warn(e);
        navigate('/', { replace: true });
      }
    };

    verifyToken();
  }, [navigate]);

  if (isValid === null) {
    // [중요] 검사 중일 땐 아무것도(위젯) 렌더링하지 않음 -> API 요청 원천 차단
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>Authentication checking...</div>;
  }

  return isValid ? <>{children}</> : null;
}