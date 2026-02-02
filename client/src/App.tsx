import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket } from './contexts/WebSocketContext';
import CesiumDetail from './pages/CesiumDetail';
import Dashboard from './pages/Dashboard';
import DeviceManagement from './pages/DeviceManagement';
import Login from './pages/Login';
import ThreeJsDetail from './pages/ThreeJsDetail';
import UserDetail from './pages/UserDetail';
import WeatherDetail from './pages/WeatherDetail';
import './styles/toast.css';

// [1] 'AppContent'라는 새 컴포넌트를 정의합니다. (이름은 제가 지은 겁니다)
// 이 친구는 <BrowserRouter> 안에서 실행될 녀석이라 useConnection(주소감지)을 쓸 수 있습니다.
function AppContent() {
  // 앱 시작 시 토큰이 있으면 대시보드로 납치하는 로직
  const navigate = useNavigate();
  const location = useLocation();

  // 훅에서 lastMessage를 꺼냅니다.
  const { lastMessage } = useWebSocket();

  // 전역 소켓 이벤트 감지 (모든 페이지 공통)
  useEffect(() => {
    if (lastMessage?.type === 'FORCE_LOGOUT') {
      console.warn("강제 로그아웃 감지!");
      // 토스트 메시지 등 처리
      localStorage.removeItem('accessToken');
      localStorage.removeItem('myId');
      navigate('/');
    }
  }, [lastMessage, navigate]);

  useEffect(() => {
    // 1. 저장소에서 토큰 확인 (로그인 유지 체크했으면 local, 아니면 session에 있음)
    const token = localStorage.getItem('accessToken');
    
    // 2. 토큰이 있고, 현재 페이지가 로그인 페이지('/')라면 -> 대시보드로 이동
    if (token && location.pathname === '/') {
      navigate('/dashboard');
    }
    // (선택사항) 반대로 토큰이 없는데 대시보드 접근하려 하면 쫓아내는 로직도 여기에 추가 가능
  }, [navigate, location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/user/:userId" element={<UserDetail />} />
        <Route path="/weather" element={<WeatherDetail />} />
        <Route path="/cesium" element={<CesiumDetail />} />
        <Route path="/threejs" element={<ThreeJsDetail />} />
        <Route path="/devices" element={<DeviceManagement />} />
      </Routes>
      <Toaster
        position='top-right'
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
            fontSize: '18px',
            padding: '16px 20px',
          },
        }}
      />
    </>
  );
}

// [2] 기존 App 컴포넌트는 '껍데기' 역할만 합니다.
function App() {
  return (
    <>
      {/* 여기서 방금 만든 AppContent를 불러옵니다 */}
      <AppContent />
    </>
  );
}
export default App