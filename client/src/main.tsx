import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UserLocationProvider } from './contexts/UserLocationContext';
import './index.css'
import App from './App.tsx'
// [추가] React Query 관련 임포트
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
