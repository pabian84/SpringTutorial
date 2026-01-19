import { createContext, useContext } from 'react';

// 위치 정보 상태 타입 정의
export interface LocationState {
  lat: number | null;
  lon: number | null;
  loading: boolean;
  error: string | null;
}

// Context 객체 생성 (내부 사용)
export const UserLocationContext = createContext<LocationState | null>(null);

// Hook을 여기서 정의 (Fast Refresh 준수)
export const useUserLocation = () => {
  const context = useContext(UserLocationContext);
  if (!context) {
    return { lat: null, lon: null, loading: false, error: 'Provider Missing' };
  }
  return context;
};