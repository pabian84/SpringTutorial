import { createContext, useContext } from 'react';

// 인증 상태 타입 정의
export interface AuthContextType {
  accessToken: string | null;
  myId: string | null;
  isAuthenticated: boolean;
  isTokenValid: () => boolean;
  getAccessToken: () => Promise<string | null>;
  login: (token: string, userId: string) => void;
  logout: (reason?: string) => Promise<void>;
}

// Context 객체 생성
export const AuthContext = createContext<AuthContextType | null>(null);

// Hook 정의 (Fast Refresh 준수)
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
