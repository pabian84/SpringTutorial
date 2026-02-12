import { createContext, useContext } from 'react';

// 사용자 정보 타입
export interface UserInfo {
  id: string;
  name: string;
}

// 인증 상태 타입 정의
export interface AuthContextType {
  authState: {
    authenticated: boolean;
    user: UserInfo | null;
    loading: boolean;
  };
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: (id: string, password: string, keepLogin: boolean) => Promise<void>;
  logout: (reason?: string) => void;
  checkAuth: () => Promise<boolean>;
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
