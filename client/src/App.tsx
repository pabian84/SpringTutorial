import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './contexts/AuthContext';
import { useWebSocket } from './contexts/WebSocketContext';
import { useEffect, useRef } from 'react';
import CesiumDetail from './pages/CesiumDetail';
import Dashboard from './pages/Dashboard';
import DeviceManagement from './pages/DeviceManagement';
import Login from './pages/Login';
import ThreeJsDetail from './pages/ThreeJsDetail';
import UserDetail from './pages/UserDetail';
import WeatherDetail from './pages/WeatherDetail';
import './styles/toast.css';

// 전역 로그아웃 이벤트 감지 및 네비게이션 처리
function GlobalLogoutHandler() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleLogout = () => {
      // 즉시 로그인 페이지로 이동
      navigate('/', { replace: true });
    };
    
    window.addEventListener('authLogout', handleLogout);
    return () => window.removeEventListener('authLogout', handleLogout);
  }, [navigate]); // navigate는 React Router에서 stable하지만 명시적
  
  return null;
}

// 전역 소켓 이벤트 감지 컴포넌트
function SocketEventHandler() {
  const { lastMessage } = useWebSocket();
  const { logout } = useAuth();
  const hasLoggedRef = useRef(false);

  useEffect(() => {
    if (lastMessage?.type === 'FORCE_LOGOUT' && !hasLoggedRef.current) {
      hasLoggedRef.current = true;
      logout('강제 로그아웃');
    }
  }, [lastMessage, logout]);

  return null;
}

// Protected Route - Outlet 패턴 사용
function ProtectedRoute() {
  // 토큰이 없으면 로그인 페이지로
  if (!localStorage.getItem('accessToken')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// Public Route - 로그인 되어 있으면 대시보드로
function PublicRoute() {
  if (localStorage.getItem('accessToken')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Login />;
}

function AppContent() {
  return (
    <>
      <GlobalLogoutHandler />
      <SocketEventHandler />
      <Routes>
        <Route path="/" element={<PublicRoute />} />
        <Route path="/dashboard" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/user/:userId" element={<UserDetail />} />
        <Route path="/weather" element={<WeatherDetail />} />
        <Route path="/cesium" element={<CesiumDetail />} />
        <Route path="/threejs" element={<ThreeJsDetail />} />
        <Route path="/devices" element={<ProtectedRoute />}>
          <Route index element={<DeviceManagement />} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
