import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketProvider';
import { useEffect } from 'react';
//import { showToast } from './utils/Alert';
import CesiumDetail from './pages/CesiumDetail';
import Dashboard from './pages/Dashboard';
import DeviceManagement from './pages/DeviceManagement';
import Login from './pages/Login';
import ThreeJsDetail from './pages/ThreeJsDetail';
import UserDetail from './pages/UserDetail';
import WeatherDetail from './pages/WeatherDetail';
import NotFound from './pages/NotFound';
import './styles/toast.css';

// Protected Route - Outlet 패턴 사용 (로딩 상태 포함)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // [TEST] ProtectedRoute 토스트
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      //showToast('[TEST] ProtectedRoute: 대시보드 접근 허용', 'success');
    }
  }, [isAuthenticated, isLoading]);

  // 로딩 중에는 아무것도 표시하지 않음 (플리커링 방지)
  if (isLoading) {
    return null; // 또는 로딩 스피너
  }

  // 인증되지 않았으면 로그인 페이지로
  if (!isAuthenticated) {
    //showToast('[TEST] ProtectedRoute: 인증 안 됨 → 로그인 페이지로', 'warning');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Public Route - 로그인 되어 있으면 대시보드로 (로딩 상태 포함)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // [TEST] PublicRoute 토스트
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      //showToast('[TEST] PublicRoute: 로그인 페이지 접근 허용', 'success');
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    const handleLogin = () => {
      // 로그인 이벤트 발생 시 대시보드로 이동
      //showToast('[TEST] PublicRoute: authLogin 이벤트 수신 → 대시보드로', 'success');
      navigate('/dashboard', { replace: true });
    };

    window.addEventListener('authLogin', handleLogin);
    return () => window.removeEventListener('authLogin', handleLogin);
  }, [navigate]);

  // 로딩 중에는 아무것도 표시하지 않음
  if (isLoading) {
    return null;
  }

  // 이미 인증되어 있으면 대시보드로
  if (isAuthenticated) {
    //showToast('[TEST] PublicRoute: 이미 인증됨 → 대시보드로', 'success');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <>
      <Routes>
        <Route path="/" element={<PublicRoute children={<Login />} />} />
        <Route path="/dashboard" element={<ProtectedRoute children={<Dashboard />} />} />
        <Route path="/user/:userId" element={<UserDetail />} />
        <Route path="/weather" element={<WeatherDetail />} />
        <Route path="/cesium" element={<CesiumDetail />} />
        <Route path="/threejs" element={<ThreeJsDetail />} />
        <Route path="/devices" element={<ProtectedRoute children={<DeviceManagement />} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </WebSocketProvider>
  );
}

export default App;
