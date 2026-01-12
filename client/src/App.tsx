import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserDetail from './pages/UserDetail'
import WeatherDetail from './pages/WeatherDetail'
import { useConnection } from './hooks/useConnection';

function App() {
  // 여기서 접속 상태 관리 훅을 실행시킵니다.
  // 이 컴포넌트가 렌더링 되면(앱이 켜지면) 자동으로 소켓 연결하고, 꺼지면 끊습니다.
  useConnection();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/user/:userId" element={<UserDetail />} />
        <Route path="/weather" element={<WeatherDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
export default App