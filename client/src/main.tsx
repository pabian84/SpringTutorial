import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // React Query 관련 임포트
import "cesium/Build/Cesium/Widgets/widgets.css"; // 세슘 스타일은 여기서 로드합니다.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css'; // 리액트 그리드 레이아웃 필수 CSS
import 'react-resizable/css/styles.css'; // 리액트 리사이저블 CSS
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { CesiumCameraProvider } from './contexts/CesiumCameraProvider';
import { UserLocationProvider } from './contexts/UserLocationProvider';
import { WebSocketProvider } from './contexts/WebSocketProvider';
import './index.css';
import { setupAxiosInterceptors } from './utils/axiosConfig';

// [추가] 앱 시작 시 Axios 인터셉터 설정 적용 (토큰 자동 첨부)
setupAxiosInterceptors();

// [추가] 클라이언트 인스턴스 생성
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserLocationProvider>
          <CesiumCameraProvider>
            <WebSocketProvider>
              <App />
            </WebSocketProvider>
          </CesiumCameraProvider>
        </UserLocationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
