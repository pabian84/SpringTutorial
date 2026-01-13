import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserDetail from './pages/UserDetail'
import WeatherDetail from './pages/WeatherDetail'
import { useConnection } from './hooks/useConnection';

// [1] 'AppContent'라는 새 컴포넌트를 정의합니다. (이름은 제가 지은 겁니다)
// 이 친구는 <BrowserRouter> 안에서 실행될 녀석이라 useConnection(주소감지)을 쓸 수 있습니다.
function AppContent() {
  // 여기서 주소 변경을 감시합니다. (이제 안전함!)
  useConnection(); 

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/user/:userId" element={<UserDetail />} />
      <Route path="/weather" element={<WeatherDetail />} />
      {/* <Route path="/mypage" element={<MyPage />} /> */}
    </Routes>
  );
}

// [2] 기존 App 컴포넌트는 '껍데기' 역할만 합니다.
function App() {
  return (
    <BrowserRouter>
      {/* 여기서 방금 만든 AppContent를 불러옵니다 */}
      <AppContent />
    </BrowserRouter>
  );
}
export default App