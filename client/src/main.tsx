import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { UserLocationProvider } from './contexts/UserLocationContext';
import './index.css';
// [추가] React Query 관련 임포트
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupAxiosInterceptors } from './utils/axiosConfig';
// 리액트 그리드 레이아웃 필수 CSS
import 'react-grid-layout/css/styles.css';
// 리액트 리사이저블 CSS
import 'react-resizable/css/styles.css';

// [추가] 앱 시작 시 Axios 인터셉터 설정 적용 (토큰 자동 첨부)
setupAxiosInterceptors();

// [추가] 클라이언트 인스턴스 생성
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UserLocationProvider>
        <App />
      </UserLocationProvider>
    </QueryClientProvider>
  </StrictMode>,
)
