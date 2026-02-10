import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "cesium/Build/Cesium/Widgets/widgets.css";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import { CesiumCameraProvider } from './contexts/CesiumCameraProvider';
import { UserLocationProvider } from './contexts/UserLocationProvider';
import './index.css';
import { setupAxiosInterceptors } from './utils/axiosConfig';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// 앱 시작 시 Axios 인터셉터 설정 적용
setupAxiosInterceptors();

// 클라이언트 인스턴스 생성
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Toaster를 Router 외부에 배치하여 페이지 이동 시에도 토스트 유지 */}
      <Toaster
        position='top-right'
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
            fontSize: '18px',
            padding: '16px 20px',
          },
        }}
      />
      <ErrorBoundary>
        <BrowserRouter>
          <UserLocationProvider>
            <CesiumCameraProvider>
              <App />
            </CesiumCameraProvider>
          </UserLocationProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
